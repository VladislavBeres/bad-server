import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import BadRequestError from '../errors/bad-request-error'
import fs from 'fs'

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }
    const MIN_FILE_SIZE = 2048 // 2kb
    if (req.file.size < MIN_FILE_SIZE) {
        // Удаляем файл
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Ошибка при удалении:', err)
        })
        return next(
            new BadRequestError(
                `Файл слишком маленький. Минимальный размер: 2kb`
            )
        )
    }
    try {
        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file?.filename}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file?.originalname,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
