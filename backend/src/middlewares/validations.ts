import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

// eslint-disable-next-line no-useless-escape
export const phoneRegExp = /^[\+\d\s\-\(\)]{7,20}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// валидация id
export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .items(
                Joi.string().custom((value, helpers) =>
                    Types.ObjectId.isValid(value)
                        ? value
                        : helpers.message({ custom: 'Невалидный id' })
                )
            )
            .min(1)
            .max(50)
            .messages({
                'array.empty': 'Не указаны товары',
                'array.min': 'Заказ должен содержать хотя бы один товар',
                'array.max': 'Заказ не может содержать больше 50 товаров',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'string.valid':
                    'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'string.empty': 'Не указан способ оплаты',
            }),
        email: Joi.string().email().required().messages({
            'string.empty': 'Не указан email',
        }),
        phone: Joi.string().required().pattern(phoneRegExp).max(20).messages({
            'string.empty': 'Не указан телефон',
            'string.max': 'Телефон не может быть длиннее 20 символов',
        }),
        address: Joi.string().required().max(200).messages({
            'string.empty': 'Не указан адрес',
            'string.max': 'Адрес не может быть длиннее 200 символов',
        }),
        total: Joi.number().required().messages({
            'string.empty': 'Не указана сумма заказа',
        }),
        comment: Joi.string().optional().allow('').max(500).messages({
            'string.max': 'Комментарий не может быть длиннее 500 символов',
        }),
    }),
})

// валидация товара.
// name и link - обязательные поля, name - от 2 до 30 символов, link - валидный url
export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().required().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string().required().messages({
            'string.empty': 'Поле "category" должно быть заполнено',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Поле "description" должно быть заполнено',
        }),
        price: Joi.number().allow(null),
    }),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string(),
        description: Joi.string(),
        price: Joi.number().allow(null),
    }),
})

export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: Joi.string()
            .required()
            .custom((value, helpers) =>
                Types.ObjectId.isValid(value)
                    ? value
                    : helpers.message({ any: 'Невалидный id' })
            ),
    }),
})

export const validateUserBody = celebrate({
    body: Joi.object().keys({
        name: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        password: Joi.string().min(6).required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.empty': 'Поле "email" должно быть заполнено',
            }),
    }),
})

export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.required': 'Поле "email" должно быть заполнено',
            }),
        password: Joi.string().required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
    }),
})

// валидация для поиска:
export const validateSearchQuery = celebrate({
    query: Joi.object().keys({
        search: Joi.string().max(100).optional().messages({
            'string.max': 'Поисковый запрос не может быть длиннее 100 символов',
        }),
        page: Joi.number()
            .min(0)
            .optional()
            .default(1)
            .custom((value) => (value === 0 ? 1 : value)),
        limit: Joi.number().min(0).max(1000).optional().default(10),
    }),
})
