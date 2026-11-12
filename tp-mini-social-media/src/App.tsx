import { useEffect, useRef, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
} from 'viem'
import { sepolia } from 'viem/chains'

const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as Address | undefined

const abi = [
  {
    type: 'function',
    name: 'publishPost',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_message', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getPost',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [
      { name: '', type: 'string' },
      { name: '', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'getTotalPosts',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })

/** EIP-6963: a wallet announces itself with a name, icon and EIP-1193 provider. */
type WalletInfo = { uuid: string; name: string; icon: string; rdns: string }
type WalletDetail = { info: WalletInfo; provider: EIP1193Provider }

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

type Post = { index: number; message: string; author: Address }
type Connection = { name: string; provider: EIP1193Provider; account: Address }

const INSTALL_LINKS: Array<{ name: string; url: string }> = [
  { name: 'Enkrypt', url: 'https://www.enkrypt.com/' },
  { name: 'MetaMask', url: 'https://metamask.io/download/' },
]

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Some wallets only inject `window.ethereum` and never announce via EIP-6963. */
function legacyWallet(): WalletDetail | undefined {
  if (!window.ethereum) return undefined
  return {
    info: { uuid: 'window.ethereum', name: 'Browser wallet', icon: '', rdns: 'injected' },
    provider: window.ethereum,
  }
}

export default function App() {
  const [wallets, setWallets] = useState<WalletDetail[]>([])
  const [connection, setConnection] = useState<Connection>()
  const [posts, setPosts] = useState<Post[]>([])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const didFallback = useRef(false)

  async function refresh() {
    if (!contractAddress) {
      setStatus('No contract address. Set VITE_CONTRACT_ADDRESS in .env.local.')
      return
    }
    try {
      const total = await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: 'getTotalPosts',
      })
      const items = await Promise.all(
        Array.from({ length: Number(total) }, (_, i) =>
          publicClient.readContract({
            address: contractAddress,
            abi,
            functionName: 'getPost',
            args: [BigInt(i)],
          }),
        ),
      )
      setPosts(
        items.map(([text, author], index) => ({ index, message: text, author })).reverse(),
      )
      setStatus(`${total} post(s) on chain.`)
    } catch (error) {
      setStatus('Could not read the contract: ' + (error as Error).message)
    }
  }

  // Ask every installed wallet to announce itself (EIP-6963).
  useEffect(() => {
    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<WalletDetail>).detail
      if (!detail?.info?.uuid || !detail.provider) return
      setWallets((current) =>
        current.some((wallet) => wallet.info.uuid === detail.info.uuid)
          ? current
          : [...current, detail],
      )
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    // If nothing announced, fall back to the plain injected provider.
    const timer = window.setTimeout(() => {
      if (didFallback.current) return
      didFallback.current = true
      setWallets((current) => {
        if (current.length > 0) return current
        const fallback = legacyWallet()
        return fallback ? [fallback] : []
      })
    }, 500)

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the UI in sync when the user switches account inside the wallet.
  useEffect(() => {
    const provider = connection?.provider
    if (!provider) return
    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts.length) {
        setConnection(undefined)
        setStatus('Wallet disconnected.')
        return
      }
      setConnection((current) =>
        current ? { ...current, account: accounts[0] as Address } : current,
      )
    }
    provider.on?.('accountsChanged', onAccountsChanged)
    return () => provider.removeListener?.('accountsChanged', onAccountsChanged)
  }, [connection?.provider])

  async function connect(wallet: WalletDetail) {
    try {
      const client = createWalletClient({ chain: sepolia, transport: custom(wallet.provider) })
      setStatus(`Asking ${wallet.info.name} for an account…`)
      const [address] = await client.requestAddresses()

      if ((await client.getChainId()) !== sepolia.id) {
        try {
          await client.switchChain({ id: sepolia.id })
        } catch {
          setStatus(`Open ${wallet.info.name} and switch to Sepolia (chain 11155111).`)
          return
        }
      }

      setConnection({ name: wallet.info.name, provider: wallet.provider, account: address })
      setStatus(`Connected with ${wallet.info.name}.`)
    } catch (error) {
      setStatus(`Connection with ${wallet.info.name} failed: ` + (error as Error).message)
    }
  }

  function disconnect() {
    setConnection(undefined)
    setStatus('Disconnected. The page can still read posts.')
  }

  async function publish() {
    if (!connection || !contractAddress || !message.trim()) return
    setBusy(true)
    try {
      const wallet = createWalletClient({
        account: connection.account,
        chain: sepolia,
        transport: custom(connection.provider),
      })
      setStatus(`Confirm the transaction in ${connection.name}…`)
      const hash = await wallet.writeContract({
        address: contractAddress,
        abi,
        functionName: 'publishPost',
        args: [message.trim()],
      })
      setStatus('Waiting for the transaction…')
      await publicClient.waitForTransactionReceipt({ hash })
      setMessage('')
      setStatus('Published: ' + hash)
      await refresh()
    } catch (error) {
      setStatus('Publish failed: ' + (error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const hasEnkrypt = wallets.some((wallet) => /enkrypt/i.test(wallet.info.name))

  return (
    <main>
      <header>
        <h1>MiniSocial</h1>
        <p className="subtitle">A message board on the Sepolia testnet.</p>
      </header>

      <section className="toolbar">
        {connection ? (
          <>
            <span className="badge">Connected via {connection.name}</span>
            <code className="account" title={connection.account}>
              {shortAddress(connection.account)}
            </code>
            <button className="button" onClick={disconnect}>
              Disconnect
            </button>
          </>
        ) : wallets.length > 0 ? (
          <>
            <span className="label">Connect:</span>
            {wallets.map((wallet) => (
              <button
                key={wallet.info.uuid}
                className="button wallet"
                onClick={() => void connect(wallet)}
              >
                {wallet.info.icon && (
                  <img className="wallet-icon" src={wallet.info.icon} alt="" width={16} height={16} />
                )}
                {wallet.info.name}
              </button>
            ))}
          </>
        ) : (
          <span className="label">No wallet detected.</span>
        )}
        <button className="button" onClick={refresh}>
          Refresh
        </button>
      </section>

      {wallets.length === 0 && (
        <p className="hint">
          Install{' '}
          {INSTALL_LINKS.map((link, i) => (
            <span key={link.name}>
              {i > 0 && ' or '}
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.name}
              </a>
            </span>
          ))}
          , then reload this page.
        </p>
      )}

      {wallets.length > 0 && !hasEnkrypt && connection === undefined && (
        <p className="hint">
          Enkrypt not detected —{' '}
          <a href="https://www.enkrypt.com/" target="_blank" rel="noreferrer">
            install Enkrypt
          </a>{' '}
          to connect with it.
        </p>
      )}

      <section className="composer">
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={connection ? 'Write a message' : 'Connect a wallet to publish'}
          maxLength={280}
          disabled={!connection}
        />
        <div className="composer-footer">
          <span className="counter">{message.length}/280</span>
          <button
            className="button primary"
            onClick={publish}
            disabled={!connection || busy || !message.trim()}
          >
            {busy ? 'Publishing…' : 'Publish post'}
          </button>
        </div>
      </section>

      <p className="status">{status || '\u00a0'}</p>

      <hr />

      <section>
        <h2>
          Posts <span className="count">{posts.length}</span>
        </h2>

        {posts.length === 0 ? (
          <p className="empty">No posts yet.</p>
        ) : (
          <ul className="posts">
            {posts.map((post) => (
              <li key={post.index}>
                <p className="post-message">{post.message}</p>
                <p className="post-meta">
                  {post.author} · post #{post.index}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
