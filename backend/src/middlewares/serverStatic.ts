import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Абсолютный путь к разрешённой директории
        const resolvedBase = path.resolve(baseDir)

        // Абсолютный путь к запрашиваемому файлу
        // Добавляем "." перед req.path, чтобы путь считался относительным
        const resolvedPath = path.resolve(baseDir, `.${req.path}`)

        // Проверяем, что итоговый путь внутри baseDir
        if (!resolvedPath.startsWith(resolvedBase)) {
            // Если нет — запрещаем доступ
            return res.status(403).send('Access forbidden')
        }

        // Проверяем, существует ли файл
        fs.access(resolvedPath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                // Если файла нет — отдаем дальше мидлварам
                return next()
            }

            // Файл существует — отправляем клиенту
            res.sendFile(resolvedPath, (sendErr) => {
                if (sendErr) {
                    next(sendErr)
                }
            })
        })
    }
}
