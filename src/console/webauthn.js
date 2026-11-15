/** WebAuthn 选项与浏览器 Credential 的 JSON 转换。 */

export function base64urlToBytes(value) {
  const text = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = text + '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeDescriptors(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    id: base64urlToBytes(item.id),
  }))
}

export function prepareCreationOptions(options) {
  return {
    ...options,
    challenge: base64urlToBytes(options.challenge),
    user: { ...options.user, id: base64urlToBytes(options.user.id) },
    excludeCredentials: decodeDescriptors(options.excludeCredentials),
  }
}

export function prepareRequestOptions(options) {
  return {
    ...options,
    challenge: base64urlToBytes(options.challenge),
    allowCredentials: decodeDescriptors(options.allowCredentials),
  }
}

export function registrationCredentialJSON(credential) {
  const response = credential.response
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      attestationObject: bytesToBase64url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  }
}

export function authenticationCredentialJSON(credential) {
  const response = credential.response
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      authenticatorData: bytesToBase64url(response.authenticatorData),
      signature: bytesToBase64url(response.signature),
      userHandle: response.userHandle ? bytesToBase64url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  }
}
