import { Stack, CfnOutput, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

import { StackCommonProps, SSM_PREFIX, CLUSTER_NAME } from '../../config';

/**
 * Create ECS Fargate cluster and shared security group for ALB ingress
 */
export class SonarqubeClusterStack extends Stack {
    constructor(scope: Construct, id: string, props: StackCommonProps) {
        super(scope, id, props);

        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/vpc-id`);
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId });

        const clusterName = `${CLUSTER_NAME}-${props.stage}`;
        const cluster = new ecs.Cluster(this, 'ecs-cluster', {
            vpc,
            clusterName,
            containerInsights: true,
        });

        const securityGroupName = `ecssg-${clusterName}`;
        const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ecs-security-group', {
            vpc,
            securityGroupName,
            description: `ECS Fargate shared security group for ALB ingress, cluster: ${cluster}`,
        });
        Tags.of(ecsSecurityGroup).add('Stage', props.stage);
        Tags.of(ecsSecurityGroup).add('Name', securityGroupName);
        
        new CfnOutput(this, 'Cluster', { value: cluster.clusterName });
        new CfnOutput(this, 'ECS Security Group ID', {value: ecsSecurityGroup.securityGroupId});

        // cluster-name and cluster-arn is used for deployment pipeline
        new ssm.StringParameter(this, 'ssm-cluster-name', { parameterName: `${SSM_PREFIX}/cluster-name`, stringValue: cluster.clusterName });
        new ssm.StringParameter(this, 'ssm-cluster-arn', { parameterName: `${SSM_PREFIX}/cluster-arn`, stringValue: cluster.clusterArn });

        // cluster-securitygroup-id is used to add inboud from ALB to Fargate service
        new ssm.StringParameter(this, 'ssm-cluster-securitygroup-id', { parameterName: `${SSM_PREFIX}/cluster-securitygroup-id`, stringValue: ecsSecurityGroup.securityGroupId });
    }
}
