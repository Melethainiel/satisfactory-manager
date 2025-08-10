var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddAzurePostgresFlexibleServer("postgresServer")
    .RunAsContainer(opt =>
    {
        opt.WithLifetime(ContainerLifetime.Persistent);
        opt.WithPgWeb();
        opt.WithDataVolume(isReadOnly: false);
    })
    .AddDatabase("postgres-db");

builder.AddNpmApp("svelte", "../SatisfactoryManager.SvelteKit", "dev")
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithReference(postgres)
    .WithExternalHttpEndpoints()
    
    .PublishAsDockerFile();


builder.Build().Run();
