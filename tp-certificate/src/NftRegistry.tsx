import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { readSheet } from 'read-excel-file/browser'
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  isAddress,
  type Address,
  type EIP1193Provider,
} from 'viem'

const nftAbi = [
  { type: 'function', name: 'MINTER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'DEFAULT_ADMIN_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'hasRole', stateMutability: 'view', inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'nextTokenId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'mintCertificate', stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }, { name: 'studentId', type: 'string' }, { name: 'uri', type: 'string' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'batchMintCertificates', stateMutability: 'nonpayable',
    inputs: [{ name: 'recipients', type: 'address[]' }, { name: 'studentIds', type: 'string[]' }, { name: 'uris', type: 'string[]' }],
    outputs: [],
  },
  {
    type: 'function', name: 'getCertificate', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'studentId', type: 'string' }, { name: 'recipient', type: 'address' }, { name: 'revoked', type: 'bool' },
      ],
    }],
  },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'revokeCertificate', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const

type Wallet = { uuid: string; name: string; icon: string; provider: EIP1193Provider }
type Connection = { name: string; provider: EIP1193Provider; account: Address }
type CertificateInput = {
  studentName: string; studentId: string; diplomaTitle: string
  issueDate: string; grade: string; recipient: string
}
type ImportRow = CertificateInput & { selected: boolean }
type Metadata = { name?: string; description?: string; attributes?: { trait_type: string; value: string }[] }
type Certificate = {
  tokenId: string; studentId: string; recipient: Address; owner: Address
  revoked: boolean; tokenURI: string; metadata?: Metadata
}

declare global { interface Window { ethereum?: EIP1193Provider } }

const address = import.meta.env.VITE_NFT_CONTRACT_ADDRESS as Address | undefined
const configured = !!address && isAddress(address)
const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'
const anvil = defineChain({
  id: 31337, name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
})
const publicClient = createPublicClient({ chain: anvil, transport: http(rpcUrl) })
const emptyForm: CertificateInput = {
  studentName: '', studentId: '', diplomaTitle: '', issueDate: '', grade: '', recipient: '',
}
const errorText = (error: unknown) => {
  const value = error as { shortMessage?: string; message?: string }
  return value.shortMessage || value.message || 'Unknown error'
}

function metadataUri(input: CertificateInput) {
  const metadata: Metadata = {
    name: input.diplomaTitle,
    description: `Academic certificate for ${input.studentName} (${input.studentId}), issued ${input.issueDate}.`,
    attributes: [
      { trait_type: 'Student name', value: input.studentName },
      { trait_type: 'Student ID', value: input.studentId },
      { trait_type: 'Diploma', value: input.diplomaTitle },
      { trait_type: 'Issue date', value: input.issueDate },
      { trait_type: 'Grade', value: input.grade || '—' },
    ],
  }
  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`
}

function readMetadata(uri: string): Metadata | undefined {
  const prefix = 'data:application/json,'
  if (!uri.startsWith(prefix)) return undefined
  try { return JSON.parse(decodeURIComponent(uri.slice(prefix.length))) as Metadata } catch { return undefined }
}

export default function NftRegistry() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [connection, setConnection] = useState<Connection>()
  const [isMinter, setIsMinter] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [count, setCount] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [lookupId, setLookupId] = useState('')
  const [certificate, setCertificate] = useState<Certificate>()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function announce(event: Event) {
      const detail = (event as CustomEvent<{ info: { uuid: string; name: string; icon: string }; provider: EIP1193Provider }>).detail
      if (!detail?.info?.uuid || !detail.provider) return
      setWallets((current) => current.some((wallet) => wallet.uuid === detail.info.uuid)
        ? current
        : [...current, { ...detail.info, provider: detail.provider }])
    }
    window.addEventListener('eip6963:announceProvider', announce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const timer = window.setTimeout(() => {
      setWallets((current) => current.length || !window.ethereum ? current : [{
        uuid: 'injected', name: 'Browser wallet', icon: '', provider: window.ethereum!,
      }])
    }, 500)
    return () => { window.removeEventListener('eip6963:announceProvider', announce); window.clearTimeout(timer) }
  }, [])

  async function refreshCount() {
    if (!configured) return
    try {
      const nextId = await publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'nextTokenId' })
      setCount(Number(nextId) - 1)
    } catch (error) { setStatus(`NFT registry unavailable: ${errorText(error)}`) }
  }

  async function refreshRoles(account: Address) {
    if (!configured) return
    try {
      const [minterRole, adminRole] = await Promise.all([
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'MINTER_ROLE' }),
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'DEFAULT_ADMIN_ROLE' }),
      ])
      const [minter, admin] = await Promise.all([
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'hasRole', args: [minterRole, account] }),
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'hasRole', args: [adminRole, account] }),
      ])
      setIsMinter(minter)
      setIsAdmin(admin)
    } catch (error) { setStatus(`Could not check wallet roles: ${errorText(error)}`) }
  }

  useEffect(() => { void Promise.resolve().then(refreshCount) }, [])
  useEffect(() => {
    if (connection) void Promise.resolve().then(() => refreshRoles(connection.account))
  }, [connection])

  async function connect(wallet: Wallet) {
    try {
      const client = createWalletClient({ chain: anvil, transport: custom(wallet.provider) })
      const [account] = await client.requestAddresses()
      if (await client.getChainId() !== anvil.id) {
        try { await client.switchChain({ id: anvil.id }) }
        catch { setStatus('Add and select Anvil Local (http://127.0.0.1:8545, chain ID 31337).'); return }
      }
      setConnection({ name: wallet.name, provider: wallet.provider, account })
      setStatus(`Connected with ${wallet.name}.`)
    } catch (error) { setStatus(`Wallet connection failed: ${errorText(error)}`) }
  }

  async function transact(
    functionName: 'mintCertificate' | 'batchMintCertificates' | 'revokeCertificate',
    args: readonly unknown[],
    success: string,
  ) {
    if (!configured || !connection) return undefined
    setBusy(true)
    try {
      const wallet = createWalletClient({ account: connection.account, chain: anvil, transport: custom(connection.provider) })
      setStatus('Confirm the transaction in your wallet…')
      const hash = await wallet.writeContract({ address: address!, abi: nftAbi, functionName, args } as never)
      setStatus('Waiting for confirmation…')
      await publicClient.waitForTransactionReceipt({ hash })
      setStatus(`${success} Tx: ${hash}`)
      await refreshCount()
      return hash
    } catch (error) {
      setStatus(`NFT transaction failed (check MINTER_ROLE / DEFAULT_ADMIN_ROLE): ${errorText(error)}`)
      return undefined
    } finally { setBusy(false) }
  }

  async function issueOne(event: FormEvent) {
    event.preventDefault()
    if (!connection) return
    if (!isMinter) { setStatus('This wallet does not have MINTER_ROLE.'); return }
    if (form.recipient && !isAddress(form.recipient)) { setStatus('Enter a valid recipient address.'); return }
    const nextId = await publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'nextTokenId' })
    const recipient = (form.recipient || connection.account) as Address
    const hash = await transact('mintCertificate', [recipient, form.studentId.trim(), metadataUri(form)], `Minted NFT #${nextId}.`)
    if (hash) {
      setForm(emptyForm)
      setLookupId(String(nextId))
      await lookup(String(nextId))
      setStatus(`Minted NFT #${nextId}. Tx: ${hash}`)
    }
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      const matrix: unknown[][] = file.name.toLowerCase().endsWith('.csv')
        ? (await file.text()).split(/\r?\n/).filter((line) => line.trim())
          .map((line) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, '')))
        : await readSheet(file)
      if (!matrix.length) throw new Error('The file has no rows.')
      const headers = matrix[0].map((value) => String(value).toLowerCase().replace(/[^a-z]/g, ''))
      const imported = matrix.slice(1).map((cells, index) => {
        const data = Object.fromEntries(headers.map((key, column) => {
          const cell = cells[column]
          const value = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '').trim()
          return [key, value]
        }))
        const row: ImportRow = {
          studentName: data.studentname || '', studentId: data.studentid || '',
          diplomaTitle: data.diplomatitle || '', issueDate: data.issuedate || '',
          grade: data.grade || '', recipient: data.recipientaddress || data.recipient || '',
          selected: true,
        }
        if (!row.studentName || !row.studentId || !row.diplomaTitle || !row.issueDate ||
          (row.recipient && !isAddress(row.recipient))) {
          throw new Error(`Invalid or missing fields on row ${index + 2}.`)
        }
        return row
      })
      if (!imported.length) throw new Error('No data rows found.')
      if (new Set(imported.map((row) => row.studentId.toLowerCase())).size !== imported.length) {
        throw new Error('The file contains duplicate student IDs.')
      }
      setRows(imported)
      setStatus(`Loaded ${imported.length} row(s). Review and select certificates to mint.`)
    } catch (error) { setRows([]); setStatus(`Could not read file: ${errorText(error)}`) }
  }

  async function issueBatch() {
    if (!connection || !isMinter) { setStatus('Connect a MINTER_ROLE wallet to issue NFTs.'); return }
    const selected = rows.filter((row) => row.selected)
    if (!selected.length) { setStatus('Select at least one row.'); return }
    const firstId = await publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'nextTokenId' })
    const hashes: string[] = []
    for (let offset = 0; offset < selected.length; offset += 5) {
      const batch = selected.slice(offset, offset + 5)
      const hash = await transact('batchMintCertificates', [
        batch.map((row) => (row.recipient || connection.account) as Address),
        batch.map((row) => row.studentId),
        batch.map((row) => metadataUri(row)),
      ], `Minted ${batch.length} NFT(s).`)
      if (!hash) return
      hashes.push(hash)
      const mintedIds = new Set(batch.map((row) => row.studentId))
      setRows((current) => current.map((row) => mintedIds.has(row.studentId) ? { ...row, selected: false } : row))
    }
    setStatus(`Minted token IDs ${firstId}–${BigInt(firstId) + BigInt(selected.length) - 1n}.`)
    setLookupId(String(firstId))
    await lookup(String(firstId))
    setStatus(`Minted token IDs ${firstId}–${BigInt(firstId) + BigInt(selected.length) - 1n}. Tx: ${hashes.join(', ')}`)
  }

  async function lookup(id = lookupId) {
    if (!configured || !/^\d+$/.test(id)) return
    try {
      const tokenId = BigInt(id)
      const [data, uri, owner] = await Promise.all([
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'getCertificate', args: [tokenId] }),
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'tokenURI', args: [tokenId] }),
        publicClient.readContract({ address: address!, abi: nftAbi, functionName: 'ownerOf', args: [tokenId] }),
      ])
      setCertificate({ tokenId: id, ...data, tokenURI: uri, owner, metadata: readMetadata(uri) })
      setStatus(`Certificate NFT #${id} found.`)
    } catch (error) {
      setCertificate(undefined)
      setStatus(`NFT not found: ${errorText(error)}`)
    }
  }

  async function revoke() {
    if (!certificate || !isAdmin) return
    const hash = await transact('revokeCertificate', [BigInt(certificate.tokenId)], `NFT #${certificate.tokenId} revoked.`)
    if (hash) setCertificate((current) => current ? { ...current, revoked: true } : current)
  }

  return (
    <main>
      <header>
        <h1>Certificate NFTs</h1>
        <p className="subtitle">Each certificate is a unique ERC-721 token on local Anvil.</p>
      </header>
      <section className="toolbar">
        {connection ? <>
          <span className="badge">{isAdmin ? 'Admin' : isMinter ? 'Minter' : 'No mint role'}</span>
          <code className="account">{connection.account.slice(0, 6)}…{connection.account.slice(-4)}</code>
          <button className="button" onClick={() => setConnection(undefined)}>Disconnect</button>
        </> : wallets.length ? <>
          <span className="label">Connect wallet:</span>
          {wallets.map((wallet) => <button className="button wallet" key={wallet.uuid} onClick={() => void connect(wallet)}>
            {wallet.icon && <img src={wallet.icon} alt="" width="16" height="16" />}{wallet.name}
          </button>)}
        </> : <span className="label">No wallet detected.</span>}
        <button className="button" onClick={() => void refreshCount()}>Refresh</button>
      </section>
      {!configured && <p className="hint">Set <code>VITE_NFT_CONTRACT_ADDRESS</code> in <code>.env.local</code> after deploying the NFT contract.</p>}
      <section className="stats"><strong>{count}</strong><span>NFT certificate{count === 1 ? '' : 's'}</span><span className="network">Anvil · 31337</span></section>

      {connection && !isMinter && <p className="hint role-warning">Connected wallet has no MINTER_ROLE; it can still look up tokens.</p>}
      {isMinter && <section className="section">
        <h2>Mint a certificate NFT</h2>
        <form className="form-grid" onSubmit={(event) => void issueOne(event)}>
          <label>Student name<input required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} /></label>
          <label>Student ID<input required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /></label>
          <label>Diploma<input required value={form.diplomaTitle} onChange={(e) => setForm({ ...form, diplomaTitle: e.target.value })} /></label>
          <label>Issue date<input required type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></label>
          <label>Grade<input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></label>
          <label className="wide">Recipient wallet (defaults to connected wallet)<input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="0x…" /></label>
          <button className="button primary" disabled={busy || !configured}>{busy ? 'Please wait…' : 'Mint NFT'}</button>
        </form>
        <details>
          <summary>Batch mint from Excel or CSV</summary>
          <p className="hint">Columns: studentName, studentId, diplomaTitle, issueDate. recipientAddress and grade are optional.</p>
          <input className="file-input" type="file" accept=".xlsx,.csv" onChange={(event) => void importFile(event.target.files?.[0])} />
          {rows.length > 0 && <>
            <div className="preview-head">
              <span>{rows.filter((row) => row.selected).length} of {rows.length} selected</span>
              <button className="text-button" onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: !current.every((item) => item.selected) })))}>Select all / none</button>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th></th><th>Student</th><th>Diploma</th><th>Date</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={`${row.studentId}-${index}`}>
                <td><input aria-label={`Select ${row.studentName}`} type="checkbox" checked={row.selected} onChange={() => setRows((current) => current.map((item, i) => i === index ? { ...item, selected: !item.selected } : item))} /></td>
                <td>{row.studentName}<small>{row.studentId}</small></td>
                <td>{row.diplomaTitle}<small>{row.grade || 'No grade'}</small></td>
                <td>{row.issueDate}</td>
              </tr>)}</tbody>
            </table></div>
            <button className="button primary" disabled={busy || !rows.some((row) => row.selected)} onClick={() => void issueBatch()}>{busy ? 'Please wait…' : 'Mint selected'}</button>
          </>}
        </details>
      </section>}

      <section className="section">
        <h2>Verify a certificate NFT</h2>
        <form className="lookup" onSubmit={(event) => { event.preventDefault(); void lookup() }}>
          <label htmlFor="nft-id">Token ID</label>
          <input id="nft-id" inputMode="numeric" required value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="e.g. 1" />
          <button className="button primary" disabled={!configured}>Look up</button>
        </form>
        {certificate && <article className={`certificate ${certificate.revoked ? 'revoked' : ''}`}>
          <div className="result-heading">
            <strong>{certificate.revoked ? 'Revoked NFT' : 'Valid NFT'} · token #{certificate.tokenId}</strong>
            {isAdmin && !certificate.revoked && <button className="button danger" onClick={() => void revoke()}>Revoke</button>}
          </div>
          <dl>
            <dt>Student ID</dt><dd>{certificate.studentId}</dd>
            <dt>Certificate</dt><dd>{certificate.metadata?.name || '—'}</dd>
            <dt>Owner</dt><dd><code>{certificate.owner}</code></dd>
            {certificate.metadata?.attributes?.map((item) => <Fragment key={item.trait_type}>
              <dt>{item.trait_type}</dt><dd>{item.value}</dd>
            </Fragment>)}
            <dt>tokenURI</dt><dd><code className="token-uri">{certificate.tokenURI}</code></dd>
          </dl>
        </article>}
      </section>
      <p className="status" role="status">{status || '\u00a0'}</p>
    </main>
  )
}
