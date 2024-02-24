'use client'

import React, { useEffect, useRef } from 'react'

import { registerApiClientCustomElement } from '../../../../../packages/api-client'

export const Wrapper = () => {
  const el = useRef(null)

  useEffect(() => {
    if (!el.current || window?.customElements.get('api-client')) return

    registerApiClientCustomElement()
  }, [el])
  return (
    <div
      id="app"
      ref={el}>
      Wrapper
      <api-client />
    </div>
  )
}
