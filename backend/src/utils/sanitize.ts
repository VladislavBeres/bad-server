import xss from 'xss'

// Санитизация HTML
export const sanitizeHtml = (input: any): any => {
    if (typeof input === 'string') {
        return xss(input, {
            whiteList: {}, // удалить все HTML теги
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style'],
        })
    }

    if (Array.isArray(input)) {
        return input.map((item) => sanitizeHtml(item))
    }

    if (input && typeof input === 'object') {
        return Object.entries(input).reduce((acc, [key, value]) => {
            acc[key] = sanitizeHtml(value)
            return acc
        }, {} as any)
    }

    return input
}
