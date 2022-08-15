#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DEFAULT_STAGE } from '../../config';
import { EcsIamRoleStack } from '../lib/ecs-iam-role-stack';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || DEFAULT_STAGE;

new EcsIamRoleStack(app, `ecs-sonarqube-fargate-iam-role-${stage}`,  {
    env,
    description: 'ECS Fargate IAM Role',
    terminationProtection: stage!==DEFAULT_STAGE
});