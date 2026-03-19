/**
 * Transform Task from Agendor to ZafChat
 * 
 * Agendor: tasks
 * ZafChat: crmTasks
 */

const { ObjectId } = require('mongodb');
const logger = require('../lib/logger');

/**
 * Task status mapping
 */
function getTaskStatus(task) {
  if (task.finishedAt) return 'completed';
  if (task.dueDate && new Date(task.dueDate) < new Date()) return 'overdue';
  return 'pending';
}

/**
 * Task type mapping (Agendor custom types → ZafChat types)
 */
const TASK_TYPE_MAP = {
  'call': 'call',
  'meeting': 'meeting',
  'email': 'email',
  'task': 'task',
  'visit': 'visit',
  'proposal': 'proposal',
  'follow_up': 'follow_up',
  'default': 'task'
};

/**
 * Transform Agendor Task to ZafChat Task
 */
function transformTask(agendorTask, mappings, config) {
  // 1. Deal ID (CRITICAL - tasks sem deal são ignoradas)
  const dealAgendorId = agendorTask.deal?.id;
  
  if (!dealAgendorId) {
    throw new Error(`Task ${agendorTask.id} has no linked deal`);
  }
  
  // 2. Map responsible user
  const responsibleAgendorId = agendorTask.assignedUsers?.[0]?.id || agendorTask.user?.id;
  const responsibleUserId = mappings.users[responsibleAgendorId] || config.DEFAULT_USER_ID;
  
  // 3. Status
  const status = getTaskStatus(agendorTask);
  
  // 4. Type
  const taskType = TASK_TYPE_MAP[agendorTask.type?.toLowerCase()] || TASK_TYPE_MAP.default;
  
  // 5. Deal lookup (will be updated after deals are migrated)
  // We store the Agendor deal ID to link later
  const dealInfo = mappings.deals?.[dealAgendorId];
  
  return {
    // Core
    title: truncate(agendorTask.text || 'Tarefa sem título', 200),
    description: agendorTask.text || null,
    type: taskType,
    
    // Status
    status: status,
    priority: 'normal',
    
    // Dates
    dueDate: agendorTask.dueDate ? new Date(agendorTask.dueDate) : null,
    completedAt: agendorTask.finishedAt ? new Date(agendorTask.finishedAt) : null,
    
    // Responsibility
    responsibleUserId: responsibleUserId,
    createdByUserId: mappings.users[agendorTask.user?.id] || responsibleUserId,
    completedByUserId: agendorTask.finishedBy?.id ? 
      (mappings.users[agendorTask.finishedBy.id] || null) : null,
    
    // Deal linkage
    dealId: dealInfo?.zafchatId ? new ObjectId(dealInfo.zafchatId) : null,
    _agendorDealId: dealAgendorId, // For linking after deals are migrated
    
    // Contact (optional, can be derived from deal)
    contactNumber: dealInfo?.contactNumber || null, // Will be filled from deal
    
    // Project
    projectId: config.PROJECT_ID,
    
    // Notes
    notes: null,
    
    // Flags
    active: status !== 'completed',
    isDeleted: false,
    
    // Timestamps
    createdAt: agendorTask.createdAt ? new Date(agendorTask.createdAt) : new Date(),
    updatedAt: agendorTask.updatedAt ? new Date(agendorTask.updatedAt) : new Date(),
    
    // Migration metadata
    _agendorId: agendorTask.id,
    _agendorType: agendorTask.type,
    _migratedFrom: 'agendor'
  };
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str) return str;
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

/**
 * Link task to deal after deals are migrated
 */
async function linkTaskToDeal(task, dealsMapping, mongoClient) {
  const dealZafchatId = dealsMapping[task._agendorDealId];
  
  if (!dealZafchatId) {
    logger.warn(`Task ${task._agendorId}: Deal ${task._agendorDealId} not found in mapping`);
    return false;
  }
  
  const tasksCollection = await mongoClient.getTasksCollection();
  
  await tasksCollection.updateOne(
    { _id: task._id },
    {
      $set: {
        dealId: new ObjectId(dealZafchatId),
        updatedAt: new Date()
      }
    }
  );
  
  return true;
}

module.exports = {
  transformTask,
  getTaskStatus,
  linkTaskToDeal,
  TASK_TYPE_MAP
};
