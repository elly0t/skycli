/**
 * Copyright 2017 Oursky Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import _, { Dictionary, PropertyPath } from 'lodash';
import * as os from 'os';
import path from 'path';
import untildify from 'untildify';

import { GlobalConfig } from './types';

const currentConfigVersion = 1;

export enum ConfigDomain {
  GlobalDomain = 'global',
  ProjectDomain = 'project'
}

const configPaths: { [domain: string]: string } = {
  global: `${process.env.XDG_CONFIG_HOME || os.homedir() + '/.config'}/skycli/config`,
  project: './skygear.yaml'
};

// tslint:disable-next-line:no-any
function migrate(configObject: Dictionary<any>) {
  const migrated = _.assign({}, configObject);
  if (typeof migrated.version === 'undefined') {
    migrated.version = currentConfigVersion;
  }

  // If we have new config version in the future, migrate the config object
  // from previous config version to the current one here.

  return migrated;
}

function findConfig(domain: ConfigDomain, exists: boolean = true) {
  const configPath = untildify(configPaths[domain]);
  const absolute = path.isAbsolute(configPath);

  let currentDir = process.cwd();
  let fullPath = absolute ? configPath : path.resolve(currentDir, configPath);
  if (!exists) {
    return fullPath;
  }

  // If the config path is not already an absolute path, recursively
  // find the config file until we find an existing one.
  while (!absolute && currentDir !== path.dirname(currentDir)) {
    fullPath = path.resolve(currentDir, configPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    currentDir = path.dirname(currentDir);
  }

  fullPath = path.resolve(currentDir, configPath);
  return fs.existsSync(fullPath) ? fullPath : undefined;
}

export function load(domain: ConfigDomain = ConfigDomain.GlobalDomain) {
  let content = {};

  const configPath = findConfig(domain);
  if (configPath) {
    content = yaml.safeLoad(fs.readFileSync(configPath, 'utf-8'));
  }

  return content;
}

export function save(
  // tslint:disable-next-line:no-any
  configObject: Dictionary<any>,
  domain: ConfigDomain = ConfigDomain.GlobalDomain
) {
  let configPath = findConfig(domain);
  if (!configPath) {
    configPath = findConfig(domain, false);
    fs.ensureDirSync(path.dirname(configPath));
  }

  const content = yaml.safeDump(configObject);
  fs.writeFileSync(configPath, content);
}

export function set(
  name: PropertyPath,
  // tslint:disable-next-line:no-any
  value: any,
  domain: ConfigDomain = ConfigDomain.GlobalDomain
) {
  const configObject = load(domain);
  const oldValue = _.get(configObject, name);
  if (value !== oldValue) {
    _.set(configObject, name, value);
    save(configObject, domain);
  }
}

export function loadGlobal() {
  const globalConfig = load(ConfigDomain.GlobalDomain) as GlobalConfig;
  // TODO: load current user
  return {
    cluster: globalConfig.cluster && globalConfig.cluster[globalConfig.currentContext]
  };
}

export function loadProject() {
  return migrate(load(ConfigDomain.ProjectDomain));
}

export const developerMode = process.env.SKYCLI_DEVELOPER_MODE === '1';
