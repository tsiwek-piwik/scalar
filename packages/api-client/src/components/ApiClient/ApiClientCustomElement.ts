// eslint-disable-next-line vue/prefer-import-from-vue
import { getGlobalThis } from '@vue/shared'
import { defineCustomElement } from 'vue'

import ApiClient from './ApiClient.vue'

// These are requied for the vue bundler version
getGlobalThis().__VUE_OPTIONS_API__ = true
getGlobalThis().__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = true
getGlobalThis().__VUE_PROD_DEVTOOLS__ = false

// @ts-expect-error emit type mismatch
export const ApiClientCustomElement = defineCustomElement(ApiClient)

// Register the custom element.
// After registration, all `<my-vue-element>` tags
// on the page will be upgraded.
export const registerApiClientCustomElement = () => {
  window?.customElements.define('api-client', ApiClientCustomElement)
}
