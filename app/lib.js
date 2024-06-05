const passworder = require('@metamask/browser-passworder')

// Deduplicates array with rudimentary non-recursive shallow comparison of keys
function dedupe (arr) {
  const result = []
  arr?.forEach(x => {
    if (!result.find(y => Object.keys(x).length === Object.keys(y).length && Object.entries(x).every(([k,ex]) => y[k] === ex ))) {
      result.push(x)
    }
  })
  return result
}

function decodeMnemonic(mnemonic) {
  if (typeof mnemonic === 'string') {
    return mnemonic
  } else {
    return Buffer.from(mnemonic).toString('utf8')
  }
}

function extractVaultFromFile (data) {
  try {
    // attempt 1: raw json
    return JSON.parse(data)
  } catch(err) {
    //Not valid JSON: continue
  }
  {
    // attempt 2: pre-v3 cleartext
    // TODO: warn user that their wallet is unencrypted
    const matches = data.match(/{"wallet-seed":"([^"}]*)"/)
    if (matches && matches.length) {
      const mnemonic = matches[1].replace(/\\n*/, '')
      const vaultMatches = data.match(/"wallet":("{[ -~]*\\"version\\":2}")/)
      const vault = vaultMatches
        ? JSON.parse(JSON.parse(vaultMatches[1]))
        : {}
      return {
        data: Object.assign(
          {},
          {
            mnemonic,
          },
          vault,
        )
      }
    }
  }
  {
    const regex = /{[^{}]*}/g;
    const ivRegex = /\\"iv.{1,4}[^A-Za-z0-9+\/]{1,10}([A-Za-z0-9+\/]{10,40}=*)/u
    const dataRegex = /\\"[^A-Za-z0-9+\/]{1,10}([A-Za-z0-9+\/]{1,30000}=*)/u
    const saltRegex = /,\\"salt.{1,4}[^A-Za-z0-9+\/]{1,10}([A-Za-z0-9+\/]{10,100}=*)/u

    const matches = data.match(regex);
    for(let i = 0; i < matches.length; i++) {
      if(matches[i].includes('salt') && matches[i].includes('iv')) {
        const vaultData = matches[i].match(dataRegex)
        const vaultSalt = matches[i].match(saltRegex)
        const vaultIv = matches[i].match(ivRegex)
        const vault = { data: vaultData[1], iv: vaultIv[1], salt: vaultSalt[1] }
        return vault
      }
    }
  }
  return null
}


function isVaultValid (vault) {
  return typeof vault === 'object'
    && ['data', 'iv', 'salt'].every(e => typeof vault[e] === 'string')
}

function decryptVault (password, vault) {
  if (vault.data && vault.data.mnemonic) {
    return [vault]
  }
  return passworder.decrypt(password, JSON.stringify(vault))
  .then((keyringsWithEncodedMnemonic) => {
    const keyringsWithDecodedMnemonic = keyringsWithEncodedMnemonic.map(keyring => {
      if ('mnemonic' in keyring.data) {
        return Object.assign(
          {},
          keyring,
          {
            data: Object.assign(
              {},
              keyring.data,
              { mnemonic: decodeMnemonic(keyring.data.mnemonic) }
            )
          }
        )
      } else {
        return keyring
      }
    })
    return keyringsWithDecodedMnemonic;
  })
}
module.exports = {
  decryptVault,
  extractVaultFromFile,
  isVaultValid,
}


