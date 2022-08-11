import * as cdk from 'aws-cdk-lib';

export const SSM_PREFIX = '/sonarqube-fargate-cdk';

export const CLUSTER_NAME = 'sonarqube-fargate';

export const DEFAULT_STAGE = 'dev';

export interface StackCommonProps extends cdk.StackProps {
    stage: string;
}