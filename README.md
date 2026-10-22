# Cake adapters

Small JavaScript modules that tell Cake how to get the model files behind a link to a model
page. Cake downloads a newer signed package from this repository's releases, so adapters can
be fixed without an app update; the package bundled with the app is the fallback.

Cake itself lives in [kappes/slicer](https://github.com/kappes/slicer); this repository started
as its `adapters/` folder.

> The repository is private for now. Cake downloads updates anonymously from
> `releases/latest/download/adapters.zip`, which GitHub serves only for public repositories,
> so until it is public the app uses the adapters bundled with it.

## How Cake uses them

When a link is shared to Cake, the adapter for the page's host runs in JavaScriptCore. It
defines

```js
async function resolve(url, cake) {
  // cake.fetch(url, { method, headers, body }) → { status, url, text, headers }
  // cake.log(message)
  return { title, designer, license, files: [{ name, url, headers }], browse };
}
```

`cake.fetch` reaches only the hosts listed for the adapter in `sites.json`. Nothing else is
available: no files, no library, no other network access.

Cake downloads the `files`. When there are none, or `browse` is true, or a download fails,
Cake shows the page itself: the user taps the site's own download button (after signing in, if
the site wants that) and Cake takes the file. Sites without an adapter always work this way.

| Site | Adapter |
| --- | --- |
| Printables | Files and details through the public API |
| MakerWorld | Details through the API; downloads on the page (they need a signed-in session) |
| Thingiverse, Thangs, Cults3D, MyMiniFactory | None yet: their pages and APIs answer only browsers; downloads on the page |

## Working on adapters

Needs Node 22 (in the Cake repository, `libslic3r/fetch-tools.sh node` puts one into `tools/`).

```bash
npm test             # every adapter against the recorded responses in test/fixtures
npm run record       # fetches the pages again and updates the recorded responses
npm run build        # dist/ with manifest.json and the scripts
```

A new adapter: add the script to `src/`, list it in `sites.json`, add a fixture in
`test/fixtures` with `adapter`, `url` and the `expect`ed result, then `npm run record`.
Raise `version` in `sites.json` for every release; Cake only takes a newer version.

To update the copy bundled with the app (Cake checked out next to this repository):

```bash
node scripts/build.mjs --copy-to ../slicer/Cake/Resources/Adapters
```

## Releases and signing

`manifest.json` lists the SHA-256 of every script and `manifest.sig` is its Ed25519 signature,
so Cake accepts only packages signed with the release key. The private key is the
`CAKE_ADAPTERS_KEY` secret of this repository (a copy is kept outside any repository); its
public key is `AdapterPackage.publicKey` in Cake. `npm run keygen` creates a new pair, should
the key ever need replacing – Cake then needs an update with the new public key. Pushing a tag like `v2` runs the tests, builds, signs and
publishes `adapters.zip` as a release (`.github/workflows/release.yml`).
