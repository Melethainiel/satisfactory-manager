var builder = DistributedApplication.CreateBuilder(args);

// PostgreSQL - Use standard PostgreSQL container for development
var postgres = builder.AddPostgres("postgres")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume()
    .WithPgAdmin()
    .AddDatabase("satisfactory");

// SvelteKit app - Aspire 9.4 + azd handle everything automatically
builder.AddNpmApp("svelte", "../SatisfactoryManager.SvelteKit", "dev")
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithReference(postgres)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile(); // azd will handle production configuration

builder.Build().Run();
