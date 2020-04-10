require("dotenv").config();
const querystring = require("querystring");
const { WebClient } = require("@slack/web-api");
const { getContent, parseDrink, drinkBlocks } = require("./utils");

const COCKTAIL_DB_API = "https://www.thecocktaildb.com/api/json/v1/1";

const web = new WebClient(process.env.BOT_USER_OAUTH_TOKEN);

module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: "Well, _hello_ there!",
  };
};

module.exports.goodbye = async (event) => {
  return {
    statusCode: 200,
    body: "Goodbyeeeee!",
  };
};

module.exports.randomCocktail = async (event) => {
  const cocktail = JSON.parse(
    await getContent(`${COCKTAIL_DB_API}/random.php`)
  );

  const [drink] = cocktail.drinks;

  const recipe = {
    blocks: drinkBlocks(parseDrink(drink)),
  };

  return { statusCode: 200, body: JSON.stringify(recipe) };
};

module.exports.cocktails = async (event) => {
  const body = querystring.parse(event.body);

  if (!body.text) {
    // Generate a modal using Block Kit
    // @see https://api.slack.com/block-kit
    const viewPayload = {
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "cocktail-search",
        title: {
          type: "plain_text",
          text: "Cocktail DB",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
        },
        blocks: [
          {
            type: "section",
            block_id: "introduction_text",
            text: {
              type: "mrkdwn",
              text:
                "Grab a quick cocktail recipe for the next virtual happy hour.",
            },
          },
          {
            type: "input",
            block_id: "name_search",
            label: {
              type: "plain_text",
              text: "Name search",
            },
            element: {
              type: "plain_text_input",
              action_id: "plain_input",
              placeholder: {
                type: "plain_text",
                text: "Enter a cocktail name",
              },
            },
          },
        ],
      },
    };

    web.views.open(viewPayload).catch((err) => console.log("err", err));

    return { statusCode: 200 };
  } else {
    const drink = await searchForDrink(body.text);

    if (drink) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          blocks: [
            {
              type: "section",
              block_id: "response_text",
              text: {
                type: "mrkdwn",
                text: `Here's the first match I found for ${body.text}:`,
              },
            },
            ...drinkBlocks(drink),
          ],
        }),
      };
    } else {
      return {
        statusCode: 200,
        body: `I couldn’t find any cocktails named "${body.text}."`,
      };
    }
  }
};

module.exports.interactive = async (event) => {
  const body = querystring.parse(event.body);
  const payload = JSON.parse(body.payload);

  if (
    payload.type === "view_submission" &&
    payload.view.callback_id === "cocktail-search"
  ) {
    const searchTerm =
      payload.view.state.values["name_search"].plain_input.value;

    const drink = await searchForDrink(searchTerm);

    if (drink) {
      web.chat.postMessage({
        channel: payload.user.id,
        blocks: [
          {
            type: "section",
            block_id: "response_text",
            text: {
              type: "mrkdwn",
              text: `Here's the first match I found for ${searchTerm}:`,
            },
          },
          ...drinkBlocks(drink),
        ],
      });

      return {
        statusCode: 200,
      };
    } else {
      const response = {
        response_action: "errors",
        errors: {
          name_search: `I couldn’t find any matches for "${searchTerm}."`,
        },
      };
      return { statusCode: 200, body: JSON.stringify(response) };
    }
  }
};

const searchForDrink = async (searchTerm) => {
  const search = await getContent(
    `${COCKTAIL_DB_API}/search.php?s=${searchTerm}`
  );

  const { drinks } = JSON.parse(search);

  if (drinks && drinks.length) {
    const drink = drinks[0];
    return parseDrink(drink);
  } else {
    return undefined;
  }
};
