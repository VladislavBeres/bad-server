import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Types } from 'mongoose' // ← ДОБАВИЛ Types
import BadRequestError from '../errors/bad-request-error' // ← ДОБАВИЛ
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'
import { filterAllowedFields } from '../utils/filterAllowedFields' // ← ИСПРАВИЛ

// TODO: Добавить guard admin
// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        const filters: FilterQuery<Partial<IUser>> = {}

        // Проверка page и limit
        const pageNum = Number(page)
        const limitNum = Number(limit)

        if (Number.isNaN(pageNum) || pageNum < 1) {
            return next(
                new BadRequestError('page должен быть положительным числом')
            )
        }
        if (Number.isNaN(limitNum) || limitNum < 1) {
            return next(
                new BadRequestError('limit должен быть положительным числом')
            )
        }
        if (limitNum > 100) {
            return next(new BadRequestError('limit не может быть больше 100'))
        }

        // Валидация дат и чисел
        if (registrationDateFrom) {
            const date = new Date(registrationDateFrom as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'registrationDateFrom должен быть валидной датой'
                    )
                )
            }
            filters.createdAt = {
                ...filters.createdAt,
                $gte: date,
            }
        }

        if (registrationDateTo) {
            const date = new Date(registrationDateTo as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'registrationDateTo должен быть валидной датой'
                    )
                )
            }
            const endOfDay = date
            endOfDay.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: endOfDay,
            }
        }

        if (lastOrderDateFrom) {
            const date = new Date(lastOrderDateFrom as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'lastOrderDateFrom должен быть валидной датой'
                    )
                )
            }
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: date,
            }
        }

        if (lastOrderDateTo) {
            const date = new Date(lastOrderDateTo as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'lastOrderDateTo должен быть валидной датой'
                    )
                )
            }
            const endOfDay = date
            endOfDay.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: endOfDay,
            }
        }

        if (totalAmountFrom) {
            const num = Number(totalAmountFrom)
            if (Number.isNaN(num)) {
                return next(
                    new BadRequestError('totalAmountFrom должен быть числом')
                )
            }
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: num,
            }
        }

        if (totalAmountTo) {
            const num = Number(totalAmountTo)
            if (Number.isNaN(num)) {
                return next(
                    new BadRequestError('totalAmountTo должен быть числом')
                )
            }
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: num,
            }
        }

        if (orderCountFrom) {
            const num = Number(orderCountFrom)
            if (Number.isNaN(num)) {
                return next(
                    new BadRequestError('orderCountFrom должен быть числом')
                )
            }
            filters.orderCount = {
                ...filters.orderCount,
                $gte: num,
            }
        }

        if (orderCountTo) {
            const num = Number(orderCountTo)
            if (Number.isNaN(num)) {
                return next(
                    new BadRequestError('orderCountTo должен быть числом')
                )
            }
            filters.orderCount = {
                ...filters.orderCount,
                $lte: num,
            }
        }

        if (search) {
            // Экранируем спецсимволы
            const escapedSearch = escapeRegExp(search as string)
            const searchRegex = new RegExp(escapedSearch, 'i')

            // Ищем заказы по адресу доставки
            const orders = await Order.find(
                {
                    deliveryAddress: { $regex: searchRegex }, // Безопаснее
                },
                '_id'
            )

            filters.$or = [{ name: searchRegex }]

            if (orders.length > 0) {
                // Убедимся, что все ID - валидные ObjectId
                const validOrderIds = orders
                    .map((order) => order._id)
                    .filter((id) => Types.ObjectId.isValid(id.toString()))

                filters.$or.push({ lastOrder: { $in: validOrderIds } })
            }
        }

        const sort: { [key: string]: any } = {}

        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1
        }

        const options = {
            sort,
            skip: (Number(page) - 1) * Number(limit),
            limit: Number(limit),
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',
                },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / Number(limit))

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: Number(page),
                pageSize: Number(limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Get /customers/:id
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Проверяем валидность ID
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const user = await User.findById(req.params.id).populate([
            'orders',
            'lastOrder',
        ])

        if (!user) {
            return next(new NotFoundError('Пользователь не найден'))
        }

        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Patch /customers/:id
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Проверяем валидность ID
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        // Разрешенные поля для обновления пользователя
        const allowedFields = ['name', 'phone']
        const updateData = filterAllowedFields(req.body, allowedFields)

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
            }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Delete /customers/:id
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Проверяем валидность ID
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
