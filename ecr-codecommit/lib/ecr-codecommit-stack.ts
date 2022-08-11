import { Construct } from 'constructs';
import { Stack, CfnOutput, Tags } from 'aws-cdk-lib';
import * as path from 'path';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';

import { StackCommonProps, SSM_PREFIX } from '../../config';

export interface EcrStackProps extends StackCommonProps {
    serviceName: string;
}
/**
 * 1. Create an ECR, build 'app/Dockerfile' and push to ECR
 * 2. Create an Code Commit repository for app folder(/repo-root/app)
 */
export class EcrCodeCommitStack extends Stack {
    constructor(scope: Construct, id: string, props: EcrStackProps) {
        super(scope, id, props);

        const stage = props.stage;
        const serviceName = props.serviceName;

        const immageAsset = new assets.DockerImageAsset(this, 'ecr-image', {
            directory: path.join(__dirname, "../../", "app")
        });
        const ecrRepo = new ecr.Repository(this, `${serviceName}`, {
            repositoryName: `${serviceName}`
        });
        new ecrdeploy.ECRDeployment(this, 'ecr-deploy', {
            src: new ecrdeploy.DockerImageName(immageAsset.imageUri),
            dest: new ecrdeploy.DockerImageName(`${ecrRepo.repositoryUriForTag('latest')}`),
        });

        const codecommitRepo = new codecommit.Repository(this, `${serviceName}-codecommit`, {
            repositoryName: `${serviceName}`
        });

        Tags.of(codecommitRepo).add('Stage', stage);
        Tags.of(ecrRepo).add('Stage', stage);

        new ssm.StringParameter(this, 'ssm-codecommit-arn', { parameterName: `${SSM_PREFIX}/codecommit-arn`, stringValue: codecommitRepo.repositoryArn });
        new ssm.StringParameter(this, 'ssm-ecr-repo-name', { parameterName: `${SSM_PREFIX}/ecr-repo-name`, stringValue: ecrRepo.repositoryName });
        new ssm.StringParameter(this, 'ssm-ecr-repo-arn', { parameterName: `${SSM_PREFIX}/ecr-repo-arn`, stringValue: ecrRepo.repositoryArn });

        new CfnOutput(this, 'EcrUri', { value: ecrRepo.repositoryUri });
        new CfnOutput(this, 'CodeCommitRepoUrl', { value: codecommitRepo.repositoryCloneUrlHttp });
    }
}
