// MakerWorld: model pages like https://makerworld.com/en/models/1029837-keychain.
// The design API tells title, designer and license. Downloads need a signed-in browser
// session, so the user downloads on the page and Cake takes the file.

async function resolve(url, cake) {
  const match = url.match(/\/models\/(\d+)/);
  if (!match) return { files: [], browse: true };

  const response = await cake.fetch('https://makerworld.com/api/v1/design-service/design/' + match[1]);
  if (response.status !== 200) return { files: [], browse: true };
  const design = JSON.parse(response.text);
  return {
    title: design.title,
    designer: design.designCreator && design.designCreator.name,
    license: design.license,
    files: [],
    browse: true,
  };
}
