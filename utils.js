/*
 * This is a minimal wrapper that wraps node's native http/http objects with
 * promises for get requests.
 */
module.exports.getContent = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith("https") ? require("https") : require("http");
    const request = lib.get(url, response => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(
          new Error("Failed to load page, status code: " + response.statusCode)
        );
      }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on("data", chunk => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on("end", () => resolve(body.join("")));
    });
    // handle connection errors of the request
    request.on("error", err => reject(err));
  });
};

// Turn a drink from Cocktail DB into a normalized object
module.exports.parseDrink = drink => {
  const {
    strDrink: name,
    strGlass: glass,
    strInstructions: instructions,
    strDrinkThumb: thumbnail
  } = drink;
  const ingredients = [];

  for (let i = 1; i <= 15; i += 1) {
    const ingredient = drink[`strIngredient${i}`];
    const quantity = drink[`strMeasure${i}`];

    if (ingredient && quantity) {
      ingredients.push([quantity, ingredient]);
    }
  }
  return { name, glass, instructions, thumbnail, ingredients };
};

// Format a drink from cocktail db nicely for Slack, using blocks
module.exports.drinkBlocks = ({
  name,
  glass,
  instructions,
  thumbnail,
  ingredients
}) => [
  {
    type: "section",
    block_id: "introduction_text",
    text: {
      type: "mrkdwn",
      text: `*${name}*`
    }
  },
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: [
        `*Glass:* ${glass}\n`,
        `*Ingredients:*`,
        ...ingredients.map(
          ([quantity, ingredient]) => `${quantity} ${ingredient}`
        ),
        `\n*Instructions*: ${instructions}\n`
      ].join("\n")
    },
    accessory: {
      type: "image",
      image_url: thumbnail,
      alt_text: "cocktail"
    }
  }
];
