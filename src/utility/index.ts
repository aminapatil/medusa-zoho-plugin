

export type RegionInfo = Pick<any, "currency_code" | "tax_code" | "tax_rate">

type ComputeAmountParams = {
    amount: number
    region: RegionInfo
    includeTaxes?: boolean
}

type FormatAmountParams = {
    amount: number
    region: RegionInfo
    includeTaxes?: boolean
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    locale?: string
}

type ConvertToLocaleParams = {
    amount: number
    currency_code: string
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    locale?: string
}

export const noDivisionCurrencies = [
    "krw",
    "jpy",
    "vnd",
    "clp",
    "pyg",
    "xaf",
    "xof",
    "bif",
    "djf",
    "gnf",
    "kmf",
    "mga",
    "rwf",
    "xpf",
    "htg",
    "vuv",
    "xag",
    "xdr",
    "xau",
]

export const isObject = (input: any) => input instanceof Object
export const isArray = (input: any) => Array.isArray(input)
export const isEmpty = (input: any) => {
    return (
        input === null ||
        input === undefined ||
        (isObject(input) && Object.keys(input).length === 0) ||
        (isArray(input) && (input as any[]).length === 0) ||
        (typeof input === "string" && input.trim().length === 0)
    )
}


export const computeAmount = ({
    amount,
    region,
    includeTaxes = true,
}: ComputeAmountParams) => {
    const toDecimal = convertToDecimal(amount, region)

    const taxRate = includeTaxes ? getTaxRate(region) : 0

    const amountWithTaxes = toDecimal * (1 + taxRate)

    return amountWithTaxes
}

const getTaxRate = (region?: RegionInfo) => {
    return region && !isEmpty(region) ? region?.tax_rate / 100 : 0
}

export const formatAmount = ({
    amount,
    region,
    includeTaxes,
    ...rest
}: FormatAmountParams) => {
    const taxAwareAmount = computeAmount({
        amount,
        region,
        includeTaxes,
    })

    return convertToLocale({
        amount: taxAwareAmount,
        currency_code: region?.currency_code,
        ...rest,
    })
}

const convertToLocale = ({
    amount,
    currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
    locale = "en-US",
}: ConvertToLocaleParams) => {
    return currency_code && !isEmpty(currency_code)
        ? new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currency_code,
            minimumFractionDigits,
            maximumFractionDigits,
        }).format(amount)
        : amount.toString()
}
const convertToDecimal = (amount: number, region: RegionInfo) => {
    const divisor = noDivisionCurrencies.includes(
        region?.currency_code?.toLowerCase()
    )
        ? 1
        : 100

    return Math.floor(amount) / divisor
}  