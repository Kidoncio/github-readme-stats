const { request, logger } = require("../common/utils");
const retryer = require("../common/retryer");
require("dotenv").config();

const fetcher = (variables, token) => {
  return request(
    {
      query: `
      query userInfo($login: String!) {
        user(login: $login) {
          repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              primaryLanguage {
                name
                color
              }
              languages(first: 100, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    color
                    name
                  }
                }
              }
            }
          }
        }
      }
      `,
      variables,
    },
    {
      Authorization: `bearer ${token}`,
    }
  );
};

async function fetchTopLanguages(username) {
  if (!username) throw Error("Invalid username");

  let res = await retryer(fetcher, { login: username });

  if (res.data.errors) {
    logger.error(res.data.errors);
    throw Error(res.data.errors[0].message || "Could not fetch user");
  }

  let repoNodes = res.data.data.user.repositories.nodes;

  repoNodes = repoNodes
    .filter((node) => {
      return node.languages.edges.length > 0;
    })
    .reduce((acc, prev) => {
      // get the size of the language (bytes)
      const primaryLanguageName = prev.primaryLanguage.name;

      let edgePrimaryLanguage = prev.languages.edges.filter((edge) => {
        return edge.node.name === primaryLanguageName;
      })[0];

      let langSize = edgePrimaryLanguage.size;

      // if we already have the language in the accumulator
      // & the current language name is same as previous name
      // add the size to the language size.
      if (
        acc[primaryLanguageName] &&
        primaryLanguageName === acc[primaryLanguageName].name
      ) {
        langSize = edgePrimaryLanguage.size + acc[primaryLanguageName].size;
      }

      return {
        ...acc,
        [primaryLanguageName]: {
          name: primaryLanguageName,
          color: edgePrimaryLanguage.node.color,
          size: langSize,
        },
      };
    }, {});

  const topLangs = Object.keys(repoNodes)
    .slice(0, 5)
    .reduce((result, key) => {
      result[key] = repoNodes[key];
      return result;
    }, {});

  return topLangs;
}

module.exports = fetchTopLanguages;
