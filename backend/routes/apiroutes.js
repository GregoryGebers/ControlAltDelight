import express from 'express';
import questionRoutes from './questionRoutes.js';
import matchRoutes from './matchRoutes.js';
import userRoutes from './userRoutes.js';
import gameRoutes from './gameRoutes.js';

const router = express.Router();

router.use('/', questionRoutes);
router.use('/', matchRoutes);
router.use('/', userRoutes);
router.use('/', gameRoutes);

export default router;