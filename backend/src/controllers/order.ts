import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import { sanitizeHtml } from '../utils/sanitize'
import escapeRegExp from '../utils/escapeRegExp'

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
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
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const filters: FilterQuery<Partial<IOrder>> = {}

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
        const normalizedLimit = Math.min(limitNum, 10)
        const normalizedPage = pageNum

        if (status) {
            if (typeof status === 'object') {
                Object.assign(filters, status)
            }
            if (typeof status === 'string') {
                filters.status = status
            }
        }
        // проверки типов для чисел
        if (totalAmountFrom) {
            const num = Number(totalAmountFrom)
            if (Number.isNaN(num)) {
                return next(
                    new BadRequestError('totalAmountFrom должен быть числом')
                )
            }
            filters.totalAmount = {
                ...(filters.totalAmount || {}),
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
                ...(filters.totalAmount || {}),
                $lte: num,
            }
        }
        // проверки типов для дат
        if (orderDateFrom) {
            const date = new Date(orderDateFrom as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'orderDateFrom должен быть валидной датой'
                    )
                )
            }
            filters.createdAt = {
                ...filters.createdAt,
                $gte: date,
            }
        }

        if (orderDateTo) {
            const date = new Date(orderDateTo as string)
            if (Number.isNaN(date.getTime())) {
                return next(
                    new BadRequestError(
                        'orderDateTo должен быть валидной датой'
                    )
                )
            }
            filters.createdAt = {
                ...filters.createdAt,
                $lte: date,
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search) {
            // Экранируем спецсимволы в поисковом запросе
            const escapedSearch = escapeRegExp(search as string)
            const searchRegex = new RegExp(escapedSearch, 'i')
            const searchNumber = Number(search)

            const searchConditions: any[] = [{ 'products.title': searchRegex }]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })

            filters.$or = searchConditions
        }

        const sort: { [key: string]: any } = {}

        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1
        }

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (normalizedPage - 1) * normalizedLimit },
            { $limit: normalizedLimit },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / normalizedLimit)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: normalizedPage,
                pageSize: normalizedLimit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = 1, limit = 5 } = req.query

        // Преобразуем page и limit в числа
        const pageNum = Number(page)
        const limitNum = Number(limit)

        // Проверка корректности чисел
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

        // Нормализуем лимит (макс. 10)
        const normalizedLimit = Math.min(limitNum, 10)
        const normalizedPage = pageNum

        const skip = (normalizedPage - 1) * normalizedLimit

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
            // Экранируем спецсимволы в поисковом запросе
            const escapedSearch = escapeRegExp(search as string)
            const searchRegex = new RegExp(escapedSearch, 'i')
            const searchNumber = Number(search)
            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                // eslint-disable-next-line max-len
                const matchesProductTitle =
                    Array.isArray(order.products) &&
                    order.products.some((product) =>
                        productIds.some((id) => id.equals(product._id))
                    )
                // eslint-disable-next-line max-len
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / normalizedLimit)

        // Срезаем массив заказов по нормализованному skip и limit
        orders = orders.slice(skip, skip + normalizedLimit)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: normalizedPage, // теперь правильная текущая страница
                pageSize: normalizedLimit, // теперь правильный pageSize
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const orderNumber = Number(req.params.orderNumber)
        if (Number.isNaN(orderNumber)) {
            return next(new BadRequestError('orderNumber должен быть числом'))
        }

        const order = await Order.findOne({ orderNumber })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному номеру отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            return res.status(403).json({ message: 'Нет доступа к заказу' })
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== Number(total)) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        // Санитизируем комментарий перед сохранением
        const sanitizedComment = comment ? sanitizeHtml(comment) : ''
        const sanitizedAddress = address ? sanitizeHtml(address) : ''

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment: sanitizedComment,
            customer: userId,
            deliveryAddress: sanitizedAddress,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params
        if (!Types.ObjectId.isValid(id)) {
            return next(new BadRequestError('Невалидный ID заказа'))
        }

        const deletedOrder = await Order.findByIdAndDelete(id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
