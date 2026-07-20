import express from 'express';
import {
  getAllWorkLogs,
  getWorkLogById,
  createWorkLog,
  updateWorkLog,
  deleteWorkLog,
} from '../controllers/workLogController.js';

const router = express.Router();

router.route('/')
  .get(getAllWorkLogs)
  .post(createWorkLog);

router.route('/:id')
  .get(getWorkLogById)
  .put(updateWorkLog)
  .delete(deleteWorkLog);

export default router;
