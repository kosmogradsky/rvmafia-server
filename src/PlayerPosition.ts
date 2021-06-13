export type PlayerPosition =
  | "playerOne"
  | "playerTwo"
  | "playerThree"
  | "playerFour"
  | "playerFive"
  | "playerSix"
  | "playerSeven"
  | "playerEight"
  | "playerNine"
  | "playerTen";

export const getPrevPlayerPosition = (
  playerPosition: PlayerPosition
): PlayerPosition => {
  switch (playerPosition) {
    case "playerOne":
      return "playerTen";
    case "playerTwo":
      return "playerOne";
    case "playerThree":
      return "playerTwo";
    case "playerFour":
      return "playerThree";
    case "playerFive":
      return "playerFour";
    case "playerSix":
      return "playerFive";
    case "playerSeven":
      return "playerSix";
    case "playerEight":
      return "playerSeven";
    case "playerNine":
      return "playerEight";
    case "playerTen":
      return "playerNine";
  }
};

export const getNextPlayerPosition = (
  playerPosition: PlayerPosition
): PlayerPosition => {
  switch (playerPosition) {
    case "playerOne":
      return "playerTwo";
    case "playerTwo":
      return "playerThree";
    case "playerThree":
      return "playerFour";
    case "playerFour":
      return "playerFive";
    case "playerFive":
      return "playerSix";
    case "playerSix":
      return "playerSeven";
    case "playerSeven":
      return "playerEight";
    case "playerEight":
      return "playerNine";
    case "playerNine":
      return "playerTen";
    case "playerTen":
      return "playerOne";
  }
};
