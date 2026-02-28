import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'
import { uploadLimiter } from '../middlewares/rateLimiter'

const uploadRouter = Router()
uploadRouter.post('/', uploadLimiter, fileMiddleware.single('file'), uploadFile)

export default uploadRouter
