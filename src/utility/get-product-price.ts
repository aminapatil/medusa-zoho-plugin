import { formatAmount } from "./index"

export function getProductPrice({
  variant,
  region,
  total,
  quantity
}: {
  variant?: any
  region: any
  total?: any
  quantity?: any
}) {
  if (!variant) {
    console.log("No product provided")
  }

  const getPercentageDiff = (original: number, calculated: number) => {
    const diff = original - calculated
    const decrease = (diff / original) * 100

    return decrease.toFixed(3)
  }

  const cheapestPrice = () => {
    if (!variant?.length || !region) {
      return null
    }


    const cheapestVariant = variant.reduce((prev, curr) => {
      return prev.calculated_price < curr.calculated_price ? prev : curr
    })
    console.log("********* CHEAPEST PRICE ***********", cheapestVariant);
    return {
      calculated_price: formatAmount({
        amount: cheapestVariant.calculated_price,
        region,
        includeTaxes: false,
      }),
      original_price: formatAmount({
        amount: cheapestVariant.original_price,
        region,
        includeTaxes: false,
      }),
      price_type: cheapestVariant.calculated_price_type,
      percentage_diff: getPercentageDiff(
        cheapestVariant.original_price,
        cheapestVariant.calculated_price
      ),
      discountPerc: getPercentageDiff(
        cheapestVariant.original_price,
        total
      ),
      discountAmt: (cheapestVariant.original_price * quantity) - total,
      discountAmtSale: (cheapestVariant.original_price * quantity) - (cheapestVariant.calculated_price * quantity),
    }
  }

  const variantPrice = () => {
    if (!variant || !region) {
      return null
    }

    // const variant = 
    // product.variants.find(
    //   (v) => v.id === variantId || v.sku === variantId
    // ) as any

    if (!variant) {
      return null
    }

    return {
      calculated_price: formatAmount({
        amount: variant.calculated_price,
        region,
        includeTaxes: false,
      }),
      original_price: formatAmount({
        amount: variant.original_price,
        region,
        includeTaxes: false,
      }),
      price_type: variant.calculated_price_type,
      percentage_diff: getPercentageDiff(
        variant.original_price,
        variant.calculated_price
      ),
    }
  }

  return {
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
