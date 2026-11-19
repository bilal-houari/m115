import { useEffect, useState, type FormEvent } from 'react'
import { readSheet } from 'read-excel-file/browser'
import NftRegistry from './NftRegistry'
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
import './App.css'

const abi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'nextId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'mintCertificate', stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' }, { name: 'studentName', type: 'string' },
      { name: 'studentId', type: 'string' }, { name: 'diplomaTitle', type: 'string' },
      { name: 'issueDate', type: 'string' }, { name: 'grade', type: 'string' },
    ], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'batchMint', stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' }, { name: 'studentNames', type: 'string[]' },
      { name: 'studentIds', type: 'string[]' }, { name: 'diplomaTitles', type: 'string[]' },
      { name: 'issueDates', type: 'string[]' }, { name: 'grades', type: 'string[]' },
    ], outputs: [],
  },
  {
    type: 'function', name: 'getCertificate', stateMutability: 'view',
    inputs: [{ name: 'certId', type: 'uint256' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'studentName', type: 'string' }, { name: 'studentId', type: 'string' },
        { name: 'diplomaTitle', type: 'string' }, { name: 'issueDate', type: 'string' },
        { name: 'grade', type: 'string' }, { name: 'recipient', type: 'address' },
      ],
    }],
  },
  { type: 'function', name: 'revoked', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'revokeCertificate', stateMutability: 'nonpayable', inputs: [{ name: 'certId', type: 'uint256' }], outputs: [] },
] as const

type WalletInfo = { uuid: string; name: string; icon: string }
type WalletDetail = { info: WalletInfo; provider: EIP1193Provider }
type Connection = { name: string; provider: EIP1193Provider; account: Address }
type Certificate = {
  studentName: string; studentId: string; diplomaTitle: string
  issueDate: string; grade: string; recipient: Address; revoked: boolean
}
type ImportRow = {
  recipient: Address
  studentName: string
  studentId: string
  diplomaTitle: string
  issueDate: string
  grade: string
  selected: boolean
}

declare global { interface Window { ethereum?: EIP1193Provider } }

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as Address | undefined
const configured = !!contractAddress && isAddress(contractAddress)
const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'
const anvil = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
})
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(rpcUrl),
})

const emptyForm = { recipient: '', studentName: '', studentId: '', diplomaTitle: '', issueDate: '', grade: '' }
const errorMessage = (error: unknown) => {
  const value = error as { message?: string; shortMessage?: string }
  return value.shortMessage || value.message || 'Unknown error'
}

function LegacyRegistry() {
  const [wallets, setWallets] = useState<WalletDetail[]>([])
  const [connection, setConnection] = useState<Connection>()
  const [owner, setOwner] = useState<Address>()
  const [count, setCount] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [lookupId, setLookupId] = useState('')
  const [certificate, setCertificate] = useState<Certificate>()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = !!connection && !!owner && connection.account.toLowerCase() === owner.toLowerCase()

  useEffect(() => {
    function announce(event: Event) {
      const detail = (event as CustomEvent<WalletDetail>).detail
      if (detail?.info?.uuid && detail.provider) {
        setWallets((current) => current.some((item) => item.info.uuid === detail.info.uuid) ? current : [...current, detail])
      }
    }
    window.addEventListener('eip6963:announceProvider', announce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const timer = window.setTimeout(() => {
      setWallets((current) => current.length || !window.ethereum ? current : [{
        info: { uuid: 'injected', name: 'Browser wallet', icon: '' }, provider: window.ethereum!,
      }])
    }, 500)
    return () => { window.removeEventListener('eip6963:announceProvider', announce); window.clearTimeout(timer) }
  }, [])

  async function refreshCount() {
    if (!configured) return
    try {
      const [next, registryOwner] = await Promise.all([
        publicClient.readContract({ address: contractAddress!, abi, functionName: 'nextId' }),
        publicClient.readContract({ address: contractAddress!, abi, functionName: 'owner' }),
      ])
      setCount(Number(next) - 1)
      setOwner(registryOwner)
    } catch (error) {
      setStatus(`Could not connect to registry: ${errorMessage(error)}`)
    }
  }

  useEffect(() => { void Promise.resolve().then(refreshCount) }, [])

  async function connect(wallet: WalletDetail) {
    try {
      const client = createWalletClient({ chain: anvil, transport: custom(wallet.provider) })
      const [account] = await client.requestAddresses()
      if (await client.getChainId() !== anvil.id) {
        try { await client.switchChain({ id: anvil.id }) }
        catch { setStatus('Add and select the Anvil Local network (RPC http://127.0.0.1:8545, chain ID 31337).'); return }
      }
      setConnection({ name: wallet.info.name, provider: wallet.provider, account })
      setStatus(`Connected with ${wallet.info.name}.`)
    } catch (error) { setStatus(`Connection failed: ${errorMessage(error)}`) }
  }

  async function transact(functionName: 'mintCertificate' | 'batchMint' | 'revokeCertificate', args: readonly unknown[], success: string) {
    if (!connection || !configured) return
    setBusy(true)
    try {
      const wallet = createWalletClient({ account: connection.account, chain: anvil, transport: custom(connection.provider) })
      setStatus('Confirm the transaction in your wallet…')
      const hash = await wallet.writeContract({
        address: contractAddress!, abi, functionName, args,
      } as never)
      setStatus('Waiting for transaction confirmation…')
      await publicClient.waitForTransactionReceipt({ hash })
      setStatus(`${success} Tx: ${hash}`)
      await refreshCount()
      return true
    } catch (error) {
      setStatus(`Transaction failed: ${errorMessage(error)}`)
      return false
    } finally { setBusy(false) }
  }

  async function mintOne(event: FormEvent) {
    event.preventDefault()
    if (form.recipient && !isAddress(form.recipient)) { setStatus('Enter a valid recipient wallet address.'); return }
    const ok = await transact('mintCertificate', [
      form.recipient || '0x0000000000000000000000000000000000000000', form.studentName.trim(), form.studentId.trim(), form.diplomaTitle.trim(), form.issueDate.trim(), form.grade.trim(),
    ], 'Certificate issued.')
    if (ok) setForm(emptyForm)
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      const normalize = (key: string) => key.toLowerCase().replace(/[^a-z]/g, '')
      const matrix: unknown[][] = file.name.toLowerCase().endsWith('.csv')
        ? (await file.text()).split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, '')))
        : await readSheet(file)
      if (!matrix.length) throw new Error('The file has no rows.')
      const headers = matrix[0].map((value) => normalize(String(value)))
      const rows = matrix.slice(1).map((cells, index) => {
        const data = Object.fromEntries(headers.map((key, column) => {
          const value = cells[column]
          const formatted = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').trim()
          return [key, formatted]
        }))
        const recipient = data.recipientaddress || data.recipient || data.wallet || ''
        const row = {
          recipient: (recipient || '0x0000000000000000000000000000000000000000') as Address,
          studentName: data.studentname || '',
          studentId: data.studentid || '',
          diplomaTitle: data.diplomatitle || '',
          issueDate: data.issuedate || '',
          grade: data.grade || '',
          selected: true,
        }
        if (!row.studentName || !row.studentId || !row.diplomaTitle || !row.issueDate || (recipient && !isAddress(recipient))) {
          throw new Error(`Invalid or missing data on row ${index + 2}. Check the column names and recipient address.`)
        }
        return row
      })
      if (!rows.length) throw new Error('No data rows found.')
      const studentIds = rows.map((row) => row.studentId.toLowerCase())
      if (new Set(studentIds).size !== studentIds.length) throw new Error('The file contains duplicate student IDs.')
      setImportRows(rows)
      setStatus(`Loaded ${rows.length} row(s). Select the certificates to issue.`)
    } catch (error) {
      setImportRows([])
      setStatus(`Could not read file: ${errorMessage(error)}`)
    }
  }

  async function mintImported() {
    const rows = importRows.filter((row) => row.selected)
    if (!rows.length) {
      setStatus('Select at least one certificate to issue.')
      return
    }
    for (let offset = 0; offset < rows.length; offset += 10) {
      const batch = rows.slice(offset, offset + 10)
      const ok = await transact('batchMint', [
        batch.map((row) => row.recipient), batch.map((row) => row.studentName), batch.map((row) => row.studentId),
        batch.map((row) => row.diplomaTitle), batch.map((row) => row.issueDate), batch.map((row) => row.grade),
      ], `Issued ${Math.min(offset + batch.length, rows.length)} of ${rows.length} certificate(s).`)
      if (!ok) return
      const issuedIds = new Set(batch.map((row) => row.studentId))
      setImportRows((current) => current.map((row) => issuedIds.has(row.studentId) ? { ...row, selected: false } : row))
    }
    setImportRows([])
    setStatus(`All ${rows.length} certificate(s) issued.`)
  }

  async function lookup(event: FormEvent) {
    event.preventDefault()
    if (!configured) return
    try {
      const id = BigInt(lookupId)
      if (id < 1n) throw new Error('Certificate ID must be greater than zero.')
      const [result, isRevoked] = await Promise.all([
        publicClient.readContract({ address: contractAddress!, abi, functionName: 'getCertificate', args: [id] }),
        publicClient.readContract({ address: contractAddress!, abi, functionName: 'revoked', args: [id] }),
      ])
      setCertificate({ ...result, revoked: isRevoked })
      setStatus('Certificate found.')
    } catch (error) {
      setCertificate(undefined)
      setStatus(`Certificate not found: ${errorMessage(error)}`)
    }
  }

  async function revoke(id: string) {
    if (!/^\d+$/.test(id)) return
    if (await transact('revokeCertificate', [BigInt(id)], 'Certificate revoked.')) {
      setCertificate((current) => current ? { ...current, revoked: true } : current)
    }
  }

  return (
    <main>
      <header>
        <h1>Certificate Registry</h1>
        <p className="subtitle">Issue and verify academic certificates on your local Anvil chain.</p>
      </header>

      <section className="toolbar">
        {connection ? <>
          <span className="badge">{isAdmin ? 'Registry admin' : `Connected · ${connection.name}`}</span>
          <code className="account">{connection.account.slice(0, 6)}…{connection.account.slice(-4)}</code>
          <button className="button" onClick={() => setConnection(undefined)}>Disconnect</button>
        </> : wallets.length ? <>
          <span className="label">Connect wallet:</span>
          {wallets.map((wallet) => <button className="button wallet" key={wallet.info.uuid} onClick={() => void connect(wallet)}>
            {wallet.info.icon && <img src={wallet.info.icon} alt="" width="16" height="16" />}{wallet.info.name}
          </button>)}
        </> : <span className="label">No wallet detected.</span>}
        <button className="button" onClick={() => void refreshCount()}>Refresh</button>
      </section>
      {!configured && <p className="hint">Set <code>VITE_CONTRACT_ADDRESS</code> in <code>.env.local</code> after deploying the registry.</p>}

      <section className="stats"><strong>{count}</strong><span>certificate{count === 1 ? '' : 's'} issued</span><span className="network">Anvil · 31337</span></section>

      {isAdmin && <section className="section">
        <h2>Issue a certificate</h2>
        <form className="form-grid" onSubmit={(event) => void mintOne(event)}>
          <label>Student name<input required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} /></label>
          <label>Student ID<input required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /></label>
          <label>Diploma<input required value={form.diplomaTitle} onChange={(e) => setForm({ ...form, diplomaTitle: e.target.value })} /></label>
          <label>Issue date<input required type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></label>
          <label>Grade<input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></label>
        <label className="wide">Recipient wallet address (optional)<input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="0x…" /></label>
          <button className="button primary" disabled={busy || !configured}>{busy ? 'Please wait…' : 'Issue certificate'}</button>
        </form>
        <details>
          <summary>Import Excel or CSV</summary>
          <p className="hint">Required columns: studentName, studentId, diplomaTitle, issueDate. recipientAddress and grade are optional.</p>
          <input className="file-input" type="file" accept=".xlsx,.csv" onChange={(event) => void importFile(event.target.files?.[0])} />
          {importRows.length > 0 && <>
            <div className="preview-head">
              <span>{importRows.filter((row) => row.selected).length} of {importRows.length} selected</span>
              <button className="text-button" onClick={() => setImportRows((rows) => rows.map((row) => ({ ...row, selected: !rows.every((item) => item.selected) })))}>Select all / none</button>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th></th><th>Student</th><th>Diploma</th><th>Date</th></tr></thead>
              <tbody>{importRows.map((row, index) => <tr key={`${row.studentId}-${index}`}>
                <td><input aria-label={`Select ${row.studentName}`} type="checkbox" checked={row.selected} onChange={() => setImportRows((rows) => rows.map((item, i) => i === index ? { ...item, selected: !item.selected } : item))} /></td>
                <td>{row.studentName}<small>{row.studentId}</small></td>
                <td>{row.diplomaTitle}<small>{row.grade || 'No grade'}</small></td>
                <td>{row.issueDate}</td>
              </tr>)}</tbody>
            </table></div>
            <button className="button primary" disabled={busy || !configured || !importRows.some((row) => row.selected)} onClick={() => void mintImported()}>{busy ? 'Please wait…' : 'Issue selected'}</button>
          </>}
        </details>
      </section>}

      <section className="section">
        <h2>Verify a certificate</h2>
        <form className="lookup" onSubmit={(event) => void lookup(event)}>
          <label htmlFor="certificate-id">Certificate ID</label>
          <input id="certificate-id" inputMode="numeric" required value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="e.g. 1" />
          <button className="button primary" disabled={!configured}>Verify</button>
        </form>
        {certificate && <article className={`certificate ${certificate.revoked ? 'revoked' : ''}`}>
          <div className="result-heading"><strong>{certificate.revoked ? 'Revoked certificate' : 'Valid certificate'}</strong>
            {isAdmin && !certificate.revoked && <button className="button danger" onClick={() => void revoke(lookupId)}>Revoke</button>}
          </div>
          <dl>
            <dt>Student</dt><dd>{certificate.studentName} · {certificate.studentId}</dd>
            <dt>Diploma</dt><dd>{certificate.diplomaTitle}</dd>
            <dt>Issue date</dt><dd>{certificate.issueDate || '—'}</dd>
            <dt>Grade</dt><dd>{certificate.grade || '—'}</dd>
            <dt>Recipient</dt><dd>{/^0x0{40}$/i.test(certificate.recipient) ? 'Not provided' : <code>{certificate.recipient}</code>}</dd>
          </dl>
        </article>}
      </section>
      <p className="status" role="status">{status || '\u00a0'}</p>
    </main>
  )
}

export default function App() {
  const [version, setVersion] = useState<'legacy' | 'nft'>('legacy')
  return (
    <div className="app-shell">
      <nav className="version-tabs" aria-label="Certificate version">
        <button className={version === 'legacy' ? 'active' : ''} onClick={() => setVersion('legacy')}>Registry records</button>
        <button className={version === 'nft' ? 'active' : ''} onClick={() => setVersion('nft')}>ERC-721 tokens</button>
      </nav>
      {version === 'legacy' ? <LegacyRegistry /> : <NftRegistry />}
    </div>
  )
}
