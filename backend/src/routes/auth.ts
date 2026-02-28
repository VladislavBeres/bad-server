import { Router } from 'express'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'
import { verifyCsrf } from '../middlewares/csrf'

const authRouter = Router()

authRouter.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken?.() })
})

authRouter.get('/user', auth, getCurrentUser)
authRouter.patch('/me', auth, verifyCsrf, updateCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.post('/login', login)
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)
authRouter.post('/register', register)

export default authRouter
