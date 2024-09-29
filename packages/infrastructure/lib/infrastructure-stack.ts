import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elasticloadbalancingv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as path from "path";
import { Construct } from "constructs";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for the ECS cluster
    const vpc = new ec2.Vpc(this, "SagebotVPC", {
      maxAzs: 2,
    });

    // Security groups for the ECS Tasks
    const websocketsSecurityGroup = new ec2.SecurityGroup(
      this,
      "WebsocketsSecurityGroup",
      {
        vpc,
        allowAllOutbound: false,
        description: "Security group for Sagebot Websockets Service",
      }
    );

    const chatbotSecurityGroup = new ec2.SecurityGroup(
      this,
      "ChatbotSecurityGroup",
      {
        vpc,
        allowAllOutbound: false,
        description: "Security group for Sagebot Chatbot Service",
      }
    );

    const cluster = new ecs.Cluster(this, "SagebotCluster", { vpc });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "SagebotRedisSubnetGroup",
      {
        description: "Subnet group for Redis (Sagebot)",
        subnetIds: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
      }
    );

    const redisSecurityGroup = new ec2.SecurityGroup(
      this,
      "SagebotRedisSecurityGroup",
      { vpc }
    );

    const redis = new elasticache.CfnCacheCluster(this, "RedisCluster", {
      clusterName: "sagebot-redis",
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });

    const bucket = new s3.Bucket(this, "SagebotContentBucket", {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, // Required for OAC
    });

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(
      this,
      "SagebotDistribution",
      {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        },
        defaultRootObject: "index.html",
      }
    );

    const taskRole = new iam.Role(this, "ChatbotTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    bucket.grantReadWrite(taskRole);

    const websocketsService =
      new ecs_patterns.NetworkLoadBalancedFargateService(
        this,
        "SagebotWebsocketsService",
        {
          cluster,
          memoryLimitMiB: 512,
          cpu: 256,
          desiredCount: 1,
          taskImageOptions: {
            image: ecs.ContainerImage.fromAsset(
              path.join(__dirname, "..", "..", ".."),
              {
                file: "packages/backend/src/microservices/websockets/Dockerfile",
                buildArgs: {
                  CACHE_BUST: new Date().getTime().toString(),
                },
              }
            ),
            environment: {
              REDIS_HOST: redis.attrRedisEndpointAddress,
              REDIS_PORT: redis.attrRedisEndpointPort,
              WS_PORT: "8080",
            },
            containerPort: 8080,
            taskRole: taskRole,
          },
          healthCheckGracePeriod: cdk.Duration.seconds(180),
          publicLoadBalancer: true,
          listenerPort: 8080,
          deploymentController: {
            type: ecs.DeploymentControllerType.ECS,
          },
          circuitBreaker: { rollback: true },
          securityGroups: [websocketsSecurityGroup],
        }
      );

    websocketsService.targetGroup.configureHealthCheck({
      port: "8081",
      protocol: elasticloadbalancingv2.Protocol.HTTP,
      path: "/health",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      healthyHttpCodes: "200-299",
    });

    websocketsService.service.connections.allowTo(
      redisSecurityGroup,
      ec2.Port.tcp(6379)
    );

    websocketsService.service.connections.allowTo(
      redisSecurityGroup,
      ec2.Port.tcp(6379)
    );

    websocketsSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS outbound traffic"
    );

    websocketsSecurityGroup.addEgressRule(
      redisSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow outbound traffic to Redis"
    );

    websocketsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      "Allow inbound WebSocket traffic"
    );

    websocketsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8081),
      "Allow inbound health check traffic"
    );

    redisSecurityGroup.addIngressRule(
      websocketsSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow inbound traffic from WebSockets service to Redis"
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "polly:SynthesizeSpeech",
          "polly:StartSpeechSynthesisTask",
          "polly:GetSpeechSynthesisTask",
        ],
        resources: ["*"],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );

    const chatbotTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "ChatbotTaskDefinition",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        taskRole: taskRole,
      }
    );

    chatbotTaskDefinition.addContainer("ChatbotContainer", {
      image: ecs.ContainerImage.fromAsset(
        path.join(__dirname, "..", "..", ".."),
        {
          file: "packages/backend/src/microservices/chatbot/Dockerfile",
          buildArgs: {
            CACHE_BUST: new Date().getTime().toString(),
          },
        }
      ),
      environment: {
        REDIS_HOST: redis.attrRedisEndpointAddress,
        REDIS_PORT: redis.attrRedisEndpointPort,
        BUCKET_NAME: bucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
        DEPLOYMENT_TIME: new Date().toISOString(),
      },
      logging: new ecs.AwsLogDriver({ streamPrefix: "ChatbotService" }),
      healthCheck: {
        command: ["CMD-SHELL", "pgrep -f 'node' > /dev/null || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    const chatbotService = new ecs.FargateService(this, "ChatbotService", {
      cluster,
      taskDefinition: chatbotTaskDefinition,
      desiredCount: 1,
      securityGroups: [chatbotSecurityGroup],
    });

    chatbotSecurityGroup.addEgressRule(
      redisSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow outbound traffic to Redis"
    );

    redisSecurityGroup.addIngressRule(
      chatbotSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow inbound traffic from Chatbot service to Redis"
    );

    chatbotSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS outbound traffic"
    );

    chatbotService.autoScaleTaskCount({
      maxCapacity: 1,
      minCapacity: 1,
    });

    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution Domain Name",
    });

    new cdk.CfnOutput(this, "WebSocketConnectionURL", {
      value: `ws://${websocketsService.loadBalancer.loadBalancerDnsName}`,
      description: "WebSocket Connection URL",
    });
  }
}
