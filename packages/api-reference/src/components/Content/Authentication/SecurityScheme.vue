<script lang="ts" setup>
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { computed } from 'vue'

import { useGlobalStore } from '../../../stores'
import { MarkdownRenderer } from '../../MarkdownRenderer'
import CardForm from './CardForm.vue'
import CardFormButton from './CardFormButton.vue'
import CardFormGroup from './CardFormGroup.vue'
import CardFormTextInput from './CardFormTextInput.vue'
import SecuritySchemeScopes from './SecuritySchemeScopes.vue'

defineProps<{
  value?: OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject
}>()

const { authentication, setAuthentication } = useGlobalStore()

const handleApiKeyTokenInput = (event: Event) => {
  setAuthentication({
    apiKey: {
      ...authentication.apiKey,
      token: (event.target as HTMLInputElement).value,
    },
  })
}

const handleHttpBasicUsernameInput = (event: Event) => {
  setAuthentication({
    http: {
      ...authentication.http,
      basic: {
        ...authentication.http.basic,
        username: (event.target as HTMLInputElement).value,
      },
    },
  })
}

const handleHttpBasicPasswordInput = (event: Event) => {
  setAuthentication({
    http: {
      ...authentication.http,
      basic: {
        ...authentication.http.basic,
        password: (event.target as HTMLInputElement).value,
      },
    },
  })
}

const handleHttpBearerTokenInput = (event: Event) => {
  setAuthentication({
    http: {
      ...authentication.http,
      bearer: {
        ...authentication.http.bearer,
        token: (event.target as HTMLInputElement).value,
      },
    },
  })
}

const handleOpenAuth2ClientIdInput = (event: Event) => {
  setAuthentication({
    oAuth2: {
      ...authentication.oAuth2,
      clientId: (event.target as HTMLInputElement).value,
    },
  })
}

const getOpenAuth2AuthorizationUrl = (flow: any) => {
  // https://example.com/oauth/authorize?
  //   response_type=token
  //   &client_id=123
  //   &redirect_uri=https%3A%2F%2Fexample.com%2Foauth2%2Fredirect
  //   &scope=write%3Apets%20read%3Apets
  //   &state=something-random

  const scopes = authentication.oAuth2.scopes.join(' ')

  const url = new URL(flow.authorizationUrl)

  url.searchParams.set('response_type', 'token')
  url.searchParams.set('client_id', authentication.oAuth2.clientId)
  url.searchParams.set('redirect_uri', window.location.href)
  url.searchParams.set('scope', scopes)
  // TODO: Generate random state string? Should we store that in the localStorage? 🤔
  url.searchParams.set('state', 'something-random')

  return url.toString()
}

const oauth2SelectedScopes = computed<string[]>({
  get: () => authentication.oAuth2.scopes,
  set: (scopes) =>
    setAuthentication({ oAuth2: { ...authentication.oAuth2, scopes } }),
})

const startAuthentication = (url: string) => {
  const windowFeatures = 'left=100,top=100,width=800,height=600'
  const handle = window.open(url, 'openAuth2Window', windowFeatures)

  if (!handle) {
    // The window wasn't allowed to open
    // This is likely caused by built-in popup blockers.
    // …
  }
}
</script>
<template>
  <CardForm v-if="value && value?.type">
    <CardFormTextInput
      v-if="value.type === 'apiKey'"
      :id="`security-scheme-${value.name}`"
      placeholder="Token"
      type="password"
      :value="authentication.apiKey.token"
      @input="handleApiKeyTokenInput">
      {{ value.in.charAt(0).toUpperCase() + value.in.slice(1) }} API Key
    </CardFormTextInput>

    <template
      v-else-if="
        value.type === 'http' || (value as unknown as any).type === 'basic'
      ">
      <!-- @vue-ignore -->
      <CardFormGroup v-if="value.type === 'basic' || value.scheme === 'basic'">
        <CardFormTextInput
          id="http.basic.username"
          placeholder="Username"
          :value="authentication.http.basic.username"
          @input="handleHttpBasicUsernameInput">
          Username
        </CardFormTextInput>
        <CardFormTextInput
          id="http.basic.password"
          placeholder="Password"
          type="password"
          :value="authentication.http.basic.password"
          @input="handleHttpBasicPasswordInput">
          Password
        </CardFormTextInput>
      </CardFormGroup>
      <CardFormTextInput
        v-else-if="value.type === 'http' && value.scheme === 'bearer'"
        id="http.bearer.token"
        placeholder="Token"
        type="password"
        :value="authentication.http.bearer.token"
        @input="handleHttpBearerTokenInput">
        Bearer Token
      </CardFormTextInput>
    </template>
    <CardFormGroup
      v-else-if="
        value.type.toLowerCase() === 'oauth2' &&
        (value as OpenAPIV3.OAuth2SecurityScheme).flows &&
        (value as OpenAPIV3.OAuth2SecurityScheme).flows.implicit
      ">
      <CardFormTextInput
        id="oAuth2.clientId"
        placeholder="Token"
        type="password"
        :value="authentication.oAuth2.clientId"
        @input="handleOpenAuth2ClientIdInput">
        Client ID
      </CardFormTextInput>
      <SecuritySchemeScopes
        v-if="value !== undefined"
        v-model:selected="oauth2SelectedScopes"
        :scopes="
          //@ts-ignore
          value.flows.implicit.scopes
        " />
      <CardFormButton
        @click="
          () =>
            startAuthentication(
              getOpenAuth2AuthorizationUrl(
                //@ts-ignore
                value?.flows.implicit,
              ),
            )
        ">
        Authorize
      </CardFormButton>
    </CardFormGroup>
  </CardForm>
  <CardForm v-if="value?.description">
    <div class="description">
      <MarkdownRenderer :value="value?.description" />
    </div>
  </CardForm>
</template>

<style scoped>
.description {
  padding: 12px 4px 4px;
  font-size: var(--theme-mini, var(--default-theme-mini));
}
</style>
