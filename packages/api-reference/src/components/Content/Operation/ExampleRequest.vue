<script setup lang="ts">
import { HttpMethod } from '@scalar/api-client'
import { ScalarCodeBlock, ScalarIcon } from '@scalar/components'
import { snippetz } from '@scalar/snippetz'
import { HTTPSnippet } from 'httpsnippet-lite'
import { computed, ref, watch } from 'vue'

import {
  getApiClientRequest,
  getHarRequest,
  getRequestFromAuthentication,
  getRequestFromOperation,
  getSecretCredentialsFromAuthentication,
  getUrlFromServerState,
} from '../../../helpers'
import { useClipboard, useSnippetTargets } from '../../../hooks'
import { useGlobalStore } from '../../../stores'
import { useTemplateStore } from '../../../stores/template'
import type { TransformedOperation } from '../../../types'
import { Card, CardContent, CardFooter, CardHeader } from '../../Card'
import ExamplePicker from './ExamplePicker.vue'
import TextSelect from './TextSelect.vue'

const props = defineProps<{
  operation: TransformedOperation
}>()

const CodeMirrorValue = ref<string>('')
const selectedExampleKey = ref<string>()
const { copyToClipboard } = useClipboard()
const { state, setItem, getClientTitle, getTargetTitle } = useTemplateStore()

const { availableTargets } = useSnippetTargets()

const { server: serverState, authentication: authenticationState } =
  useGlobalStore()

const hasMultipleExamples = computed<boolean>(
  () =>
    props.operation.information?.requestBody?.content?.['application/json']
      ?.examples &&
    Object.keys(
      props.operation.information?.requestBody?.content?.['application/json']
        .examples,
    ).length > 1,
)

const generateSnippet = async (): Promise<string> => {
  // Generate a request object
  const request = getHarRequest(
    {
      url: getUrlFromServerState(serverState) ?? window.location.origin,
    },
    getRequestFromOperation(
      props.operation,
      {
        replaceVariables: true,
      },
      selectedExampleKey.value,
    ),
    getRequestFromAuthentication(
      authenticationState,
      props.operation.information?.security,
    ),
  )

  // Actually generate the snippet
  try {
    // Snippetz
    if (
      snippetz().hasPlugin(
        state.selectedClient.targetKey.replace('javascript', 'js'),
        // @ts-ignore
        state.selectedClient.clientKey,
      )
    ) {
      return (
        snippetz().print(
          // @ts-ignore
          state.selectedClient.targetKey.replace('javascript', 'js'),
          state.selectedClient.clientKey,
          request,
        ) ?? ''
      )
    }

    // httpsnippet-lite
    const snippet = new HTTPSnippet(request)
    return (await snippet.convert(
      state.selectedClient.targetKey,
      state.selectedClient.clientKey,
    )) as string
  } catch (e) {
    console.error('[ExampleRequest]', e)
    return ''
  }
}

watch(
  [
    // Update snippet when a different client is selected
    () => state.selectedClient,
    // … or the global server state changed
    () => serverState,
    // … or the global authentication state changed
    () => authenticationState,
    // … or the selected example key
    () => selectedExampleKey,
  ],
  async () => {
    CodeMirrorValue.value = await generateSnippet()
  },
  {
    deep: true,
    immediate: true,
  },
)

computed(() => {
  return getApiClientRequest({
    serverState: serverState,
    authenticationState: authenticationState,
    operation: props.operation,
  })
})
</script>
<template>
  <Card class="dark-mode">
    <CardHeader muted>
      <div class="request-header">
        <HttpMethod
          as="span"
          class="request-method"
          :method="operation.httpVerb" />
        <slot name="header" />
      </div>
      <template #actions>
        <TextSelect
          class="request-client-picker"
          :modelValue="JSON.stringify(state.selectedClient)"
          :options="
            availableTargets.map((target) => {
              return {
                value: target.key,
                label: target.title,
                options: target.clients.map((client) => {
                  return {
                    value: JSON.stringify({
                      targetKey: target.key,
                      clientKey: client.key,
                    }),
                    label: client.title,
                  }
                }),
              }
            })
          "
          @update:modelValue="
            (value) => setItem('selectedClient', JSON.parse(value))
          ">
          {{ getTargetTitle(state.selectedClient) }}
          {{ getClientTitle(state.selectedClient) }}
        </TextSelect>

        <button
          class="copy-button"
          type="button"
          @click="copyToClipboard(CodeMirrorValue)">
          <ScalarIcon
            icon="Clipboard"
            width="10px" />
        </button>
      </template>
    </CardHeader>
    <CardContent
      borderless
      class="request-editor-section custom-scroll"
      frameless>
      <!-- Multiple examples -->
      <div class="code-snippet">
        <ScalarCodeBlock
          :content="CodeMirrorValue"
          :hideCredentials="
            getSecretCredentialsFromAuthentication(authenticationState)
          "
          :lang="state.selectedClient.targetKey"
          lineNumbers />
      </div>
    </CardContent>
    <CardFooter
      v-if="hasMultipleExamples || $slots.footer"
      class="request-card-footer"
      contrast>
      <div
        v-if="hasMultipleExamples"
        class="request-card-footer-addon">
        <ExamplePicker
          class="request-example-selector"
          :examples="
            operation.information?.requestBody?.content?.['application/json']
              ?.examples ?? []
          "
          @update:modelValue="(value) => (selectedExampleKey = value)" />
      </div>
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
<style scoped>
.request {
  display: flex;
  flex-wrap: nowrap;
}
.request-header {
  display: flex;
  gap: 6px;
  text-transform: initial;
}
.request-method {
  font-family: var(--theme-font-code, var(--default-theme-font-code));
  text-transform: uppercase;
}
.request-client-picker {
  padding-left: 12px;
  padding-right: 9px;
  border-right: 1px solid
    var(--theme-border-color, var(--default-theme-border-color));
}

.copy-button {
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  background: transparent;
  display: flex;
  cursor: pointer;
  color: var(--theme-color-3, var(--default-theme-color-3));
  margin-left: 6px;
  margin-right: 10.5px;
  border: none;
  border-radius: 3px;
  padding: 0;
  display: flex;
  align-items: center;
  height: fit-content;
}
/* Can't use flex align center on parent (scalar-card-header-actions) so have to match sibling font size vertically align*/
.copy-button:after {
  content: '.';
  color: transparent;
  font-size: var(--theme-mini, var(--default-theme-mini));
  line-height: 1.35;
  width: 0px;
}
.copy-button:hover {
  color: var(--theme-color-1, var(--default-theme-color-1));
}

.copy-button svg {
  width: 13px;
  height: 13px;
}

.request-card-footer {
  display: flex;
  justify-content: end;
  padding: 6px;
  flex-shrink: 0;
}
.request-card-footer-addon {
  display: flex;
  align-items: center;

  flex: 1;
  min-width: 0;
}
.request-editor-section {
  display: flex;
  flex: 1;
}

.code-snippet {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
