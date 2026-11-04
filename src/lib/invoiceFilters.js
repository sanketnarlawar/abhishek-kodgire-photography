// In-memory only, so a page reload resets the filters.
let saved = null

export const getSavedInvoiceFilters = () => saved
export const saveInvoiceFilters = (filters) => {
  saved = filters
}
export const clearSavedInvoiceFilters = () => {
  saved = null
}
