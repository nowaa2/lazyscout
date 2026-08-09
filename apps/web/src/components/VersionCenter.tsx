import { useEffect, useState } from 'react'
import {
  ApiError,
  getAppVersions,
  installAppVersion,
  type AppVersionInfo,
  type AppVersionInstallResult
} from '../api/client'

function formatPublishedAt(value?: string): string {
  if (!value) return 'Published on npm'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function VersionCenter() {
  const [info, setInfo] = useState<AppVersionInfo>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [pendingVersion, setPendingVersion] = useState<string>()
  const [installingVersion, setInstallingVersion] = useState<string>()
  const [installResult, setInstallResult] = useState<AppVersionInstallResult>()
  const [copiedVersion, setCopiedVersion] = useState<string>()

  async function loadVersions() {
    setLoading(true)
    setError(undefined)
    try {
      setInfo(await getAppVersions())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check npm versions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVersions()
  }, [])

  async function copyCommand(version: string) {
    await navigator.clipboard.writeText(`npm install -g lazyscout@${version}`)
    setCopiedVersion(version)
    window.setTimeout(() => setCopiedVersion((current) => (current === version ? undefined : current)), 1600)
  }

  async function install(version: string) {
    setInstallingVersion(version)
    setPendingVersion(undefined)
    setInstallResult(undefined)
    setError(undefined)
    try {
      setInstallResult(await installAppVersion(version))
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.hint
          ? `${caught.message} ${caught.hint}`
          : caught instanceof Error
            ? caught.message
            : 'Could not install this version.'
      )
    } finally {
      setInstallingVersion(undefined)
    }
  }

  return (
    <section className="version-center">
      <header className="version-center-head">
        <div className="version-center-icon">V</div>
        <div>
          <span className="eyebrow">Version Center</span>
          <h3>Choose your LazyScout version</h3>
          <p>Install the latest release or switch to an earlier published version before opening a workspace.</p>
        </div>
        <button type="button" className="version-refresh" onClick={() => void loadVersions()} disabled={loading}>
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </header>

      {loading && !info ? (
        <div className="version-loading">
          <span className="scout-spinner" /> Checking npm Registry…
        </div>
      ) : info ? (
        <>
          <div className="version-summary">
            <div>
              <small>Running now</small>
              <strong>v{info.currentVersion}</strong>
            </div>
            <span className="version-summary-arrow">→</span>
            <div>
              <small>Latest release</small>
              <strong>{info.latestVersion ? `v${info.latestVersion}` : 'Unavailable'}</strong>
            </div>
            <span className={`version-state ${info.updateAvailable ? 'has-update' : ''}`}>
              {info.updateAvailable ? 'Update available' : 'Up to date'}
            </span>
          </div>

          <div className="version-list" aria-label="Published LazyScout versions">
            {info.versions.map((item) => {
              const isCurrent = item.version === info.currentVersion
              const isPending = item.version === pendingVersion
              const isInstalling = item.version === installingVersion
              return (
                <div className={`version-row ${isCurrent ? 'is-current' : ''}`} key={item.version}>
                  <div className="version-number">
                    <span>v{item.version}</span>
                    <small>{formatPublishedAt(item.publishedAt)}</small>
                  </div>
                  <div className="version-tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                    {isCurrent && <span className="current">running</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary version-copy"
                    onClick={() => void copyCommand(item.version)}
                  >
                    {copiedVersion === item.version ? 'Copied' : 'Copy command'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary version-install"
                    disabled={isCurrent || Boolean(installingVersion)}
                    onClick={() => setPendingVersion(isPending ? undefined : item.version)}
                  >
                    {isCurrent ? 'Current' : isInstalling ? 'Installing…' : 'Install'}
                  </button>
                  {isPending && (
                    <div className="version-confirm">
                      <span>
                        Install <b>v{item.version}</b> globally? Restart LazyScout after installation to use it.
                      </span>
                      <button type="button" className="btn btn-secondary" onClick={() => setPendingVersion(undefined)}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => void install(item.version)}>
                        Install v{item.version}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      {info && !info.registryAvailable && (
        <div className="version-message warning">npm Registry is unavailable. {info.error}</div>
      )}
      {error && <div className="version-message error">{error}</div>}
      {installResult && (
        <div className="version-message success">
          <b>LazyScout v{installResult.installedVersion} installed.</b>
          <span>Close the current LazyScout terminal and run `lazyscout` again to switch versions.</span>
        </div>
      )}
    </section>
  )
}
