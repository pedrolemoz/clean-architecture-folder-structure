import * as _ from "lodash";
import * as changeCase from "change-case";
import * as mkdirp from "mkdirp";
import * as path from "path";

import {
  commands,
  ExtensionContext,
  InputBoxOptions,
  OpenDialogOptions,
  Uri,
  window,
} from "vscode";

import { existsSync, lstatSync } from "fs";

import { analyzeDependencies } from "./utils";

export function activate(_context: ExtensionContext) {
  analyzeDependencies();

  commands.registerCommand("extension.new-feature", async (uri: Uri) => {
    // Show module prompt
    let moduleName = await promptForModuleName();

    // Abort if name is not valid
    if (!isNameValid(moduleName)) {
      window.showErrorMessage("The name must not be empty");
      return;
    }
    moduleName = `${moduleName}`;

    let targetDirectory = "";
    try {
      targetDirectory = await getTargetDirectory(uri);
    } catch (error) {
      window.showErrorMessage(error.message);
    }


    const pascalCaseModuleName = changeCase.pascalCase(
      moduleName.toLowerCase()
    );
    try {
      await generateModuleArchitecture(
        `${moduleName}`,
        targetDirectory,
      );
      window.showInformationMessage(
        `Successfully Generated ${pascalCaseModuleName} Module`
      );
    } catch (error) {
      window.showErrorMessage(
        `Error:
        ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    }
  });
}

export function isNameValid(moduleName: string | undefined): boolean {
  // Check if module name exists
  if (!moduleName) {
    return false;
  }
  // Check if module name is null or white space
  if (_.isNil(moduleName) || moduleName.trim() === "") {
    return false;
  }

  // Return true if module name is valid
  return true;
}

export async function getTargetDirectory(uri: Uri): Promise<string> {
  let targetDirectory;
  if (_.isNil(_.get(uri, "fsPath")) || !lstatSync(uri.fsPath).isDirectory()) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      throw Error("Please select a valid directory");
    }
  } else {
    targetDirectory = uri.fsPath;
  }

  return targetDirectory;
}

export async function promptForTargetDirectory(): Promise<string | undefined> {
  const options: OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "Select a folder to create the module in",
    canSelectFolders: true,
  };

  return window.showOpenDialog(options).then((uri) => {
    if (_.isNil(uri) || _.isEmpty(uri)) {
      return undefined;
    }
    return uri[0].fsPath;
  });
}

export function promptForModuleName(): Thenable<string | undefined> {
  const blocNamePromptOptions: InputBoxOptions = {
    prompt: "Module Name",
    placeHolder: "login",
  };
  return window.showInputBox(blocNamePromptOptions);
}



export async function generateModuleArchitecture(
  moduleName: string,
  targetDirectory: string,
) {
  // Create the modules directory if its does not exist yet
  const modulesDirectoryPath = getModulesDirectoryPath(targetDirectory);
  if (!existsSync(modulesDirectoryPath)) {
    await createDirectory(modulesDirectoryPath);
  }

  // Create the module directory
  const moduleDirectoryPath = path.join(modulesDirectoryPath, moduleName);
  await createDirectory(moduleDirectoryPath);

  // Create the infrastructure layer
  const dataDirectoryPath = path.join(moduleDirectoryPath, "infrastructure");
  await createDirectories(dataDirectoryPath, [
    "datasources",
    "models",
    "repositories",
  ]);

  // Create the domain layer
  const domainDirectoryPath = path.join(moduleDirectoryPath, "domain");
  await createDirectories(domainDirectoryPath, [
    "entities",
    "repositories",
    "usecases",
  ]);

  // Create the presentation layer
  const presentationDirectoryPath = path.join(
    moduleDirectoryPath,
    "presentation"
  );
  await createDirectories(presentationDirectoryPath, [
    "controllers",
    "pages",
    "widgets",
  ]);

  // Generate the bloc code in the presentation layer
  // await generateBlocCode(moduleName, presentationDirectoryPath, useEquatable);
}

export function getModulesDirectoryPath(currentDirectory: string): string {
  // Split the path
  const splitPath = currentDirectory.split(path.sep);

  // Remove trailing \
  if (splitPath[splitPath.length - 1] === "") {
    splitPath.pop();
  }

  // Rebuild path
  const result = splitPath.join(path.sep);

  // Determines whether we're already in the modules directory or not
  const isDirectoryAlreadyModules =
    splitPath[splitPath.length - 1] === "modules";

  // If already return the current directory if not, return the current directory with the /modules append to it
  return isDirectoryAlreadyModules ? result : path.join(result, "modules");
}

export async function createDirectories(
  targetDirectory: string,
  childDirectories: string[]
): Promise<void> {
  // Create the parent directory
  await createDirectory(targetDirectory);
  // Creat the children
  childDirectories.map(
    async (directory) =>
      await createDirectory(path.join(targetDirectory, directory))
  );
}

function createDirectory(targetDirectory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirp(targetDirectory, (error) => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
}
