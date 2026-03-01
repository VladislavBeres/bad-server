// Фильтрует входящие данные, оставляя только разрешенные поля

export const filterAllowedFields = (body: any, allowedFields: string[]) => {
    const filtered: any = {}

    Object.keys(body).forEach((key) => {
        // Если поле в белом списке - оставляем
        if (allowedFields.includes(key)) {
            filtered[key] = body[key]
        }
        // Если поле начинается с $ - это оператор MongoDB, игнорируем
        if (key.startsWith('$')) {
            console.warn('Попытка использовать MongoDB оператор:', key)
        }
    })

    return filtered
}
