import express from 'express';
import {
  getAllKnowledge,
  getKnowledgeById,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from '../controllers/knowledgeController.js';

const router = express.Router();

router.route('/')
  .get(getAllKnowledge)
  .post(createKnowledge);

router.route('/:id')
  .get(getKnowledgeById)
  .put(updateKnowledge)
  .delete(deleteKnowledge);

export default router;
