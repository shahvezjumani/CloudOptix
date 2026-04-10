import config from "./src/config/index.js";
import app from "./src/app.js";

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
