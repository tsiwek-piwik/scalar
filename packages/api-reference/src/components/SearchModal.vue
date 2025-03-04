<script setup lang="ts">
import { HttpMethod } from '@scalar/api-client'
import { FlowModal, type ModalState } from '@scalar/use-modal'
import { useMagicKeys, whenever } from '@vueuse/core'
import Fuse from 'fuse.js'
import type { OpenAPIV3_1 } from 'openapi-types'
import { computed, ref, toRef, watch } from 'vue'

import { getHeadingsFromMarkdown } from '../helpers'
import { extractRequestBody } from '../helpers/specHelpers'
import { type ParamMap, useNavState, useOperation, useSidebar } from '../hooks'
import type { Spec, TransformedOperation } from '../types'

const props = defineProps<{ parsedSpec: Spec; modalState: ModalState }>()
const reactiveSpec = toRef(props, 'parsedSpec')

const keys = useMagicKeys()

type FuseData = {
  title: string
  href: string
  type: 'req' | 'webhook' | 'model' | 'heading'
  operationId?: string
  description: string
  body?: string | string[] | ParamMap
  httpVerb?: string
  path?: string
  tag?: string
  operation?: TransformedOperation
}

const fuseDataArray = ref<FuseData[]>([])
const searchResults = ref<Fuse.FuseResult<FuseData>[]>([])
const selectedSearchResult = ref<number>(0)
const searchText = ref<string>('')
const searchModalRef = ref<HTMLElement | null>(null)

const fuse = new Fuse(fuseDataArray.value, {
  keys: ['title', 'description', 'body'],
})

const fuseSearch = (): void => {
  selectedSearchResult.value = 0
  searchResults.value = fuse.search(searchText.value)
}

const selectedEntry = computed<Fuse.FuseResult<FuseData>>(
  () => searchResultsWithPlaceholderResults.value[selectedSearchResult.value],
)

const { getHeadingId, getWebhookId, getModelId, getOperationId, getTagId } =
  useNavState()

watch(
  () => props.modalState.open,
  (open) => {
    if (!open) return
    searchText.value = ''
    selectedSearchResult.value = 0
    searchResults.value = []
  },
)

watch(
  reactiveSpec.value,
  async () => {
    fuseDataArray.value = []

    // Likely an incomplete/invalid spec
    if (!props.parsedSpec?.tags?.length && !props.parsedSpec?.webhooks) {
      fuse.setCollection([])
      return
    }

    // Headings from the description
    const headingsData: FuseData[] = []
    const headings = await getHeadingsFromMarkdown(
      props.parsedSpec.info?.description ?? '',
    )

    if (headings.length) {
      headings.forEach((heading) => {
        headingsData.push({
          type: 'heading',
          title: `Info > ${heading.value}`,
          description: '',
          href: `#${getHeadingId(heading)}`,
          tag: heading.slug,
          body: '',
        })
      })

      fuseDataArray.value = fuseDataArray.value.concat(headingsData)
    }

    // Tags
    props.parsedSpec.tags?.forEach((tag) => {
      const tagData: FuseData = {
        title: tag.name,
        href: `#${getTagId(tag)}`,
        description: tag.description,
        type: 'req',
        tag: tag.name,
        body: '',
      }

      fuseDataArray.value.push(tagData)

      if (tag.operations) {
        tag.operations.forEach((operation) => {
          const { parameterMap } = useOperation({ operation })
          const bodyData = extractRequestBody(operation) || parameterMap.value
          let body = null
          if (typeof bodyData !== 'boolean') {
            body = bodyData
          }

          const operationData: FuseData = {
            type: 'req',
            title: operation.name ?? operation.path,
            href: `#${getOperationId(operation, tag)}`,
            operationId: operation.operationId,
            description: operation.description ?? '',
            httpVerb: operation.httpVerb,
            path: operation.path,
            tag: tag.name,
            operation,
          }

          if (body) {
            operationData.body = body
          }

          fuseDataArray.value.push(operationData)
        })
      }
    })

    // Adding webhooks
    const webhooks = props.parsedSpec.webhooks
    const webhookData: FuseData[] = []

    if (webhooks) {
      Object.keys(webhooks).forEach((name) => {
        const httpVerbs = Object.keys(
          webhooks[name],
        ) as OpenAPIV3_1.HttpMethods[]

        httpVerbs.forEach((httpVerb) => {
          webhookData.push({
            type: 'webhook',
            title: `Webhook: ${webhooks[name][httpVerb]?.name}`,
            href: `#${getWebhookId(name, httpVerb)}`,
            description: name,
            httpVerb,
            tag: name,
            body: '',
          })
        })

        fuseDataArray.value = fuseDataArray.value.concat(webhookData)
      })
    }

    // Adding models as well
    const schemas = props.parsedSpec.components?.schemas
    const modelData: FuseData[] = []

    if (schemas) {
      Object.keys(schemas).forEach((k) => {
        modelData.push({
          type: 'model',
          title: 'Model',
          href: `#${getModelId(k)}`,
          description: (schemas[k] as any).title ?? k,
          tag: k,
          body: '',
        })
      })

      fuseDataArray.value = fuseDataArray.value.concat(modelData)
    }

    fuse.setCollection(fuseDataArray.value)
  },
  { immediate: true },
)

whenever(keys.enter, () => {
  if (!props.modalState.open) {
    return
  }

  if (!window) {
    return
  }

  onSearchResultClick(selectedEntry.value)
  window.location.hash = selectedEntry.value.item.href
  props.modalState.hide()
})

whenever(keys.ArrowDown, () => {
  if (!props.modalState.open) {
    return
  }

  if (!window) {
    return
  }

  if (
    selectedSearchResult.value <
    searchResultsWithPlaceholderResults.value.length - 1
  ) {
    selectedSearchResult.value++
  } else {
    selectedSearchResult.value = 0
  }

  document.getElementById(selectedEntry.value.item.href)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
})

whenever(keys.ArrowUp, () => {
  if (!props.modalState.open) {
    return
  }

  if (!window) {
    return
  }

  if (selectedSearchResult.value > 0) {
    selectedSearchResult.value--
  } else {
    selectedSearchResult.value =
      searchResultsWithPlaceholderResults.value.length - 1
  }

  document.getElementById(selectedEntry.value.item.href)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
})

const searchResultsWithPlaceholderResults = computed(
  (): Fuse.FuseResult<FuseData>[] => {
    if (searchText.value.length === 0) {
      return fuseDataArray.value.map((item) => {
        return {
          item: item,
        } as Fuse.FuseResult<FuseData>
      })
    }

    return searchResults.value
  },
)

const tagRegex = /#(tag\/[^/]*)/
const { setCollapsedSidebarItem } = useSidebar()

// Ensure we open the section
const onSearchResultClick = (entry: Fuse.FuseResult<FuseData>) => {
  let parentId = 'models'
  const tagMatch = entry.item.href.match(tagRegex)

  if (tagMatch?.length && tagMatch.length > 1) {
    parentId = tagMatch[1]
  }
  setCollapsedSidebarItem(parentId, true)
  props.modalState.hide()
}
</script>
<template>
  <FlowModal
    :state="modalState"
    variant="search">
    <div
      ref="searchModalRef"
      class="ref-search-container">
      <input
        v-model="searchText"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        class="ref-search-input"
        placeholder="Search …"
        spellcheck="false"
        type="text"
        @input="fuseSearch" />
    </div>
    <div
      v-if="searchResultsWithPlaceholderResults.length"
      class="ref-search-list custom-scroll">
      <a
        v-for="(entry, index) in searchResultsWithPlaceholderResults"
        :id="entry.item.href"
        :key="entry.refIndex"
        class="item-entry"
        :class="{
          'item-entry--active': index === selectedSearchResult,
          'item-entry--tag': !entry.item.httpVerb,
        }"
        :href="entry.item.href"
        @click="onSearchResultClick(entry)"
        @focus="selectedSearchResult = index">
        <HttpMethod
          as="div"
          class="item-entry-http-verb"
          :method="entry.item.httpVerb ?? 'get'"
          short />
        <div
          v-if="entry.item.title"
          class="item-entry-title">
          {{ entry.item.title }}
        </div>

        <div
          v-if="
            (entry.item.httpVerb || entry.item.path) &&
            entry.item.path !== entry.item.title
          "
          class="item-entry-path">
          {{ entry.item.path }}
        </div>
        <div
          v-else-if="entry.item.description"
          class="item-entry-description">
          {{ entry.item.description }}
        </div>
      </a>
    </div>
    <div class="ref-search-meta">
      <span>↑↓ Navigate</span>
      <span>⏎ Select</span>
    </div>
  </FlowModal>
</template>
<style scoped>
a {
  text-decoration: none;
}
/** Input */
.ref-search-input {
  width: 100%;
  background: transparent;
  padding: 12px;
  font-size: var(--theme-font-size-4, var(--default-theme-font-size-4));
  outline: none;
  border: 1px solid var(--theme-border-color, var(--default-theme-border-color));
  border-radius: var(--theme-radius, var(--default-theme-radius));
  color: var(--theme-color-1, var(--default-theme-color-1));
  font-weight: var(--theme-semibold, var(--default-theme-semibold));
  font-size: var(--theme-font-size-3, var(--default-theme-font-size-3));
  font-family: var(--theme-font, var(--default-theme-font));
  appearance: none;
}
.ref-search-input:focus {
  border-color: var(--theme-color-1, var(--default-theme-color-1));
}
/** Results */
.item-entry {
  appearance: none;
  background: transparent;
  border: none;
  outline: none;
  padding: 9px 12px;
  width: 100%;
  color: var(--theme-color-3, var(--default-theme-color-3));
  text-align: left;
  border-radius: var(--theme-radius, var(--default-theme-radius));
  display: flex;
  align-items: center;
  font-family: var(--theme-font);
  min-height: 31px;
  display: flex;
  gap: 6px;
  overflow: hidden;
}
.item-entry-http-verb:empty {
  display: none;
}
.ref-search-list {
  padding: 0 12px 12px 12px;
}
.ref-search-container {
  padding: 12px;
}
.item-entry--active,
.item-entry:hover {
  background: var(--theme-background-2, var(--default-theme-background-2));
  cursor: pointer;
}

/** If it’s a tag, let’s put a dash between the tag name and the description and set the margin to the gap size. */
.item-entry--tag .item-entry-description::before {
  content: '–';
  margin-right: 6px;
}
.item-entry-description,
.item-entry-title {
  font-weight: var(--theme-semibold, var(--default-theme-semibold));
  color: var(--theme-color-1, var(--default-theme-color-1));
  font-size: var(--theme-font-size-4, var(--default-theme-font-size-4));
  white-space: nowrap;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-entry-title {
  min-width: fit-content;
}
.item-entry-http-verb,
.item-entry-subtitle {
  display: flex;
  font-size: var(--theme-font-size-4, var(--default-theme-font-size-4));
  font-family: var(--theme-font-code, var(--default-theme-font-code));
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-entry-http-verb {
  text-transform: uppercase;
  min-width: 45px;
  position: relative;
  /* optically center since all characters  above baseline*/
  top: 0.5px;
}
.item-entry-path {
  color: var(--theme-color-3, var(--default-theme-color-3));
  font-size: var(--theme-font-size-4, var(--default-theme-font-size-4));
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ref-search-meta {
  background: var(--theme-background-3, var(--default-theme-background-3));
  padding: 6px 12px;
  font-size: var(--theme-font-size-4, var(--default-theme-font-size-4));
  color: var(--theme-color-3, var(--default-theme-color-3));
  font-weight: var(--theme-semibold, var(--default-theme-semibold));
  display: flex;
  gap: 12px;
}
</style>
