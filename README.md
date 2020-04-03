# Serverless AWS Slackbot Starter

You want to make a Slackbot. You want to make it quickly. This is where you get started. This starter uses [Serverless](https://serverless.com/) to deploy to AWS to use lambdas and an API gateway to get your Slackbot started with less fuss than you could possibly imagine.

## Guide

There are some steps involved in getting thing set up.

### Create a Slack App

Go to [api.slack.com/apps](https://api.slack.com/apps). You'll need to have privileges for a Slack workspace. Then go ahead and create a new app. Go ahead and give it an icon and a background color once you've done so. You could do this later, or you could spend an hour right now combing Google images for the perfect image. I support you either way.

### Set up a project

- Go to an empty directory, then `npm init`.
- Just hit 'enter' till you're done. You can fill in those empty values in your `package.json` later.
- `npm install serverless`
- Run serverless locally with `npx serverless` to initialize your project.¹ Select node, then call your app whatever you want. You'll be asked about using a Serverless test account: you don't need to use one, but it's fine to create one if you want to (they're free).
- Go ahead and copy the files _out_ of the directory serverless created for your app, then delete that directory. (`mv myNewApp/* ./ && rm -r myNewApp`) This step is just my preference, but I prefer having the node project and the serverless project co-located.

¹ Serverless's own instructions have you install serverless as a global module. I prefer keeping it local. Just remember to prefix all your serverless commands from here on out with `npx`.

### Interacting with your new project

- `npx serverless invoke local --function hello`

You can run functions locally--very useful for development--with Serverless's "invoke local" command.

- Add new functions

Adding new functions is easy -- just put a new export in `handler.js`, then add a new entry to your `serverless.yml` file.

`handler.js`:

```javascript
module.exports.goodbye = async event => {
  return {
    statusCode: 200,
    body: "Goodbyeeeee!"
  };
};
```

`serverless.yml`:

```yml
functions:
  goodbye:
    handler: handler.goodbye
```

### Create an Endpoint

For Slack to be able to use your function, you'll need to create an endpoint. To do this, you'll use an API Gateway, an AWS feature that lets you hook a public URL into other AWS features, like lambdas. Adding them in Serverless is really easy.

`serverless.yml`

```yml
functions:
  hello:
    handler: handler.hello
    events:
      - http: POST hello
```

This is shorthand form: you can make this configuration much more explicit and overwrite Serverless's defaults if you need to.

### Pre-deployment Development

Serverless has a fantastic plugin that emulates how your functions and API Gateways work _locally_, so that you can develop without having to make repeated, time-consuming pushes to AWS.

- `npm install serverless-offline --save-dev`
- If your installation was successful, you should see it listed in `npx serverless --verbose`
- Kick things off with `npx serverless offline`
- If you want, you can go ahead and double-check the endpoint using Postman, or your tool of choice.

### Make your localhost endpoints available to Slack

You've got a functional localhost endpoint, but to make this endpoint available to Slack prior to actual deployment on AWS, you can use [ngrok](https://ngrok.com/), an incredibly useful tool & service that exposes localhost through public URLs for demo & development purchases.

- [Install ngrok](https://ngrok.com/download) and create an account (it's free and worth it)
- `ngrok http 3000`
- Grab the new public URL it shows you (it should look like `https://<somehash>.ngrok.io`)
- If you want, you can use Postman again to check the endpoint from earlier, but with your ngrok URL swapped in for localhost. This URL will work for as long as you keep _this particular_ ngrok process running. When you quit and restart, you'll get a new URL.

### Add a slash command to Slack

- Go to `api.slack.com/apps`, select your app, then go to "slash commands." Create a new command—in thise case, just call it `/hello`. Then put your ngrok URL + the path to your function (it's displayed when you start up `npx serverless offline`) in the Request URL. Click save.
- Click "install app" in the left-hand nav. You'll need to reinstall your app when you make changes.
- Go to Slack for your workspace, then try using the slash command. If everything worked, you should have your new app respond to you.

### Try deploying!

You'll need to have AWS credentials set up to do this part.

- `npx serverless deploy`
- Check out the URLs is gives you and copy the URL prefix.
- Go into Slack, go to your previous slash command, and paste in the new public URL.
- Verify that it works
- Celebrate!

---

## Create Cocktail Bot

What can you do with a Slack bot? Let's create a Cocktail Bot to see some of Slack's powers in action.

### Create a `/randomCocktail` command

Let's use a public API from [the Cocktail DB](https://www.thecocktaildb.com/api.php) to make a command that does something useful. (I have a generous standard of usefulness.)

- Create a new function and endpoint to get a random cocktail in `handler.js` and `serverless.yml`
- Grab some way to make a get request in Node. A simple, convenient way to go is to make [a simple wrapper to work with Node's native http module using promises](https://github.com/neagle/serverless-slackbot-starter/blob/master/utils.js#L5-L27).
- In your new function, use the CocktailDB API to get a random cocktail:

```javascript
// I tucked my getContent function in a utils file. You can structure your stuff
// however you want.
const { getContent } = require("./utils");

const cocktail = JSON.parse(await getContent(`${COCKTAIL_DB_API}/random.php`));

module.exports.randomCocktail = async event => {
  const [drink] = cocktail.drinks;
  console.log("Drink:", drink);

  // You'll update this before you're done, but you want it in place while you
  // work so that you can test your function as you go
  return { statusCode: 200 };
};
```

- Fire up `npx serverless offline` (or restart it), fire up ngrok (if it's not already up), then create a new slash command at [api.slack.com/apps](https://api.slack.com/apps). Re-install your app.
- Try it out in Slack. You shouldn't get a response in Slack, but you can check your `serverless offline` process and you should get the `console.log` output from your new function.

### Use Block Kit to present more than just text

The recipe we got back has enough information that it could really benefit from some UI attention. The way to do that in Slack is with [blocks](https://api.slack.com/block-kit). One of the easiest ways to start using it is to grab an existing template in the [block kit builder](https://api.slack.com/tools/block-kit-builder) take individual pieces of it or modify parts of it to do what you need.

In our case, we're going to create some relatively simple blocks to format our information nicely and display the drink's thumbnail.

First, let's make the object that Cocktail DB returns to us a little easier to work with. If you're following my lead with a `utils.js` file, add a function to parse the drink object we get back from the API.

```javascript
// Turn a drink from Cocktail DB into a normalized object
module.exports.parseDrink = drink => {
  const {
    strDrink: name,
    strGlass: glass,
    strInstructions: instructions,
    strDrinkThumb: thumbnail
  } = drink;
  const ingredients = [];

  // Cocktail DB returns a list of up to 15 ingredients.
  //
  // Any cocktail that uses more than 15 ingredients doesn't deserve to be
  // called a cocktail.
  for (let i = 1; i <= 15; i += 1) {
    const ingredient = drink[`strIngredient${i}`];
    const quantity = drink[`strMeasure${i}`];

    if (ingredient && quantity) {
      ingredients.push([quantity, ingredient]);
    }
  }
  return { name, glass, instructions, thumbnail, ingredients };
};
```

Now, let's create another function in utils to create some blocks for us.

```javascript
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
```

Now let's use these two functions in our `randomCocktail` function:

```javascript
const { getContent, parseDrink, drinkBlocks } = require("./utils");

module.exports.randomCocktail = async event => {
  const cocktail = JSON.parse(
    await getContent(`${COCKTAIL_DB_API}/random.php`)
  );

  const [drink] = cocktail.drinks;

  const recipe = {
    blocks: drinkBlocks(parseDrink(drink))
  };

  return { statusCode: 200, body: JSON.stringify(recipe) };
};
```

Restart `serverless offline`, then try running your command. If all went well, you should see a nicely formatted recipe, perfect for serving up at your next happy hour.

### Next Steps

Getting a random cocktail isn't necessarily the most useful thing in the world: you might not have the right ingredients. The code in this repo shows how to create a modal that lets you search for a cocktail by name, which will give you a taste of how to use an interactive endpoint, opening up a powerful new way to let users interact with your bot.

Important concepts:

- Useful modules: dotenv, @slack/web-api
- Adding scopes
- Your bot's interactive endpoint

Thanks for reading!
