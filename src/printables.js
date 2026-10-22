// Printables: model pages like https://www.printables.com/model/3161-3d-benchy.
// The public GraphQL API names the model files and hands out a download link for each.

const API = 'https://api.printables.com/graphql/';

async function query(cake, text, variables) {
  const response = await cake.fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: text, variables }),
  });
  if (response.status !== 200) throw new Error('Printables answered ' + response.status);
  const json = JSON.parse(response.text);
  if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function resolve(url, cake) {
  const match = url.match(/\/model\/(\d+)/);
  if (!match) return { files: [], browse: true };
  const id = match[1];

  const { print } = await query(cake,
    'query Model($id: ID!) { print(id: $id) { name user { publicUsername } license { name } stls { id name } } }',
    { id });
  if (!print) return { files: [], browse: true };

  const files = [];
  for (const file of print.stls || []) {
    const { getDownloadLink } = await query(cake,
      'mutation Link($id: ID!, $printId: ID!) { getDownloadLink(id: $id, printId: $printId, fileType: stl, source: model_detail) { ok output { link } } }',
      { id: file.id, printId: id });
    if (getDownloadLink && getDownloadLink.ok) files.push({ name: file.name, url: getDownloadLink.output.link });
  }
  return {
    title: print.name,
    designer: print.user && print.user.publicUsername,
    license: print.license && print.license.name,
    files,
    // Without links (e.g. a paid model) the user downloads on the page.
    browse: files.length === 0,
  };
}
