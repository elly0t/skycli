import globby from '@skygeario/globby';
import chalk from 'chalk';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import tar from 'tar';

import { controller } from '../../api';
import { CLIContext } from '../../types';
import { Checksum } from '../../types/artifact';
import { CloudCodeStatus } from '../../types/cloudCode';
import { CloudCodeConfig } from '../../types/cloudCodeConfig';
import { Arguments, createCommand } from '../../util';
import requireUser from '../middleware/requireUser';

function archivePath() {
  return path.join(os.tmpdir(), 'skygear-src.tgz');
}

function createArchiveReadStream() {
  return fs.createReadStream(archivePath());
}

function archiveSrc(srcPath: string) {
  return globby(srcPath, {
    dot: true,
    gitignore: true,
    gitignoreName: '.skyignore'
  })
    .then((paths: string[]) => {
      // globby returns path relative to the current dir
      // transform the path relative to srcPath for archive
      return paths.map((p) => path.relative(srcPath, p));
    })
    .then((paths: string[]) => {
      const opt = {
        cwd: srcPath,
        file: archivePath(),
        gzip: true,
        // set portable to true, so the archive is the same for same content
        portable: true
      };
      return tar.c(opt, paths);
    });
}

function getChecksum(): Promise<Checksum> {
  const md5 = crypto.createHash('md5');
  const sha256 = crypto.createHash('sha256');
  return new Promise((resolve, reject) => {
    try {
      const stream = createArchiveReadStream();
      stream.on('data', (data) => {
        md5.update(data, 'utf8');
        sha256.update(data, 'utf8');
      });

      stream.on('end', () => {
        resolve({
          md5: md5.digest('base64'),
          sha256: sha256.digest('base64')
        });
      });

      stream.on('error', (err: Error) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function archiveCloudCode(
  name: string,
  cloudCode: CloudCodeConfig
): Promise<Checksum> {
  console.log(chalk`Deploying cloud code: {green ${name}}`);
  await archiveSrc(cloudCode.src);
  console.log('Archive created');
  const checksum = await getChecksum();
  console.log(`Archive checksum md5: ${checksum.md5}`);
  console.log(`Archive checksum sha256: ${checksum.sha256}`);
  return checksum;
}

function waitForCloudCodeDeployStatus(
  context: CLIContext,
  cloudCodeID: string
) {
  console.log(chalk`Wait for cloud code to deploy: {green ${cloudCodeID}}`);
  return new Promise((resolve, reject) =>
    waitForCloudCodeDeployStatusImpl(context, cloudCodeID, resolve, reject)
  );
}

function waitForCloudCodeDeployStatusImpl(
  context: CLIContext,
  cloudCodeID: string,
  // tslint:disable-next-line:no-any
  resolve: any,
  // tslint:disable-next-line:no-any
  reject: any
) {
  controller.getCloudCode(context, cloudCodeID).then(
    (result) => {
      if (
        result.status === CloudCodeStatus.Running ||
        result.status === CloudCodeStatus.DeployFailed
      ) {
        resolve(result.status);
        return;
      }

      if (result.status !== CloudCodeStatus.Pending) {
        reject(new Error(`Unexpected cloud code status: ${result.status}`));
        return;
      }

      setTimeout(() => {
        waitForCloudCodeDeployStatusImpl(context, cloudCodeID, resolve, reject);
      }, 3000);
    },
    (err) => {
      reject(err);
    }
  );
}

async function createArtifact(context: CLIContext, checksum: Checksum) {
  console.log(chalk`Uploading archive`);
  const result = await controller.createArtifactUpload(context, checksum);
  const stream = createArchiveReadStream();
  await controller.uploadArtifact(result.uploadRequest, checksum.md5, stream);
  console.log(chalk`Archive uploaded`);
  const artifactID = await controller.createArtifact(
    context,
    result.artifactRequest
  );
  console.log(chalk`Artifact created`);
  return artifactID;
}

async function run(argv: Arguments) {
  const name = argv.name as string;
  // TODO: support deploying all cloud code at once
  // skygear-controller need an api to support batch deploy
  if (name == null || name === '') {
    console.error(chalk`Need name of cloud code, use --name`);
    return;
  }

  const cloudCodeMap = argv.appConfig.cloudCode || {};
  const cloudCode = cloudCodeMap[name];
  if (cloudCode == null) {
    console.error(chalk`Cloud code {red ${name}} not found`);
    return;
  }

  console.log(chalk`Deploy cloud code to app: {green ${argv.context.app}}`);
  try {
    const checksum = await archiveCloudCode(name, cloudCode);
    const artifactID = await createArtifact(argv.context, checksum);
    const cloudCodeID = await controller.createCloudCode(
      argv.context,
      name,
      cloudCode,
      artifactID
    );
    const cloudCodeStatus = await waitForCloudCodeDeployStatus(
      argv.context,
      cloudCodeID
    );
    if (cloudCodeStatus === CloudCodeStatus.Running) {
      console.log(chalk`Cloud code deployed`);
    } else {
      console.log(chalk`Cloud code failed to deploy`);
    }
  } catch (error) {
    console.error(`Failed deploy cloud code ${name}:`, error);
  }
}

export default createCommand({
  builder: (yargs) => {
    return yargs
      .middleware(requireUser)
      .option('app', {
        desc: 'Application name',
        type: 'string'
      })
      .option('name', {
        desc: 'Cloud code name',
        type: 'string'
      });
  },
  command: 'deploy',
  describe: 'Deploy skygear cloud code',
  handler: run
});