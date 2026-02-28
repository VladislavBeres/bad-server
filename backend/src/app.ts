import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS, MAX_JSON_SIZE, ORIGIN_ALLOW } from './config'
import errorHandler from './middlewares/error-handler'
import { globalLimiter } from './middlewares/rateLimiter'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'
import { generateCsrf } from './middlewares/csrf'

const { PORT = 3000 } = process.env
const app = express()

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:'],
            },
        },
        crossOriginResourcePolicy: { policy: 'same-site' },
        xssFilter: true,
        noSniff: true,
    })
)

app.use(cookieParser())

app.use(
    cors({
        origin: ORIGIN_ALLOW,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
)
// app.use(cors({ origin: ORIGIN_ALLOW, credentials: true }));
// app.use(express.static(path.join(__dirname, 'public')));

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(globalLimiter)

app.use(urlencoded({ extended: true, limit: MAX_JSON_SIZE }))
app.use(json({ limit: MAX_JSON_SIZE }))

app.use(generateCsrf)

app.use(routes)
app.use(errors())
app.use(errorHandler)

// eslint-disable-next-line no-console

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        console.error(error)
    }
}

bootstrap()
