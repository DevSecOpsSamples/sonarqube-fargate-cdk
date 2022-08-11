#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DEFAULT_STAGE } from '../../config';
import { SonarqubeServiceStack } from '../lib/sonarqube-fargate-stack';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || DEFAULT_STAGE;

const serviceName = 'sonarqube';
new SonarqubeServiceStack(app, `ecs-sonarqube-fargate-${stage}`, {
    env,
    stage,
    serviceName,
    description: 'ECS Fargate service for Sonarqube',
    terminationProtection: stage!==DEFAULT_STAGE
});
