var builder = DistributedApplication.CreateBuilder(args);


// Paramètres (pris depuis .env.local en dev, ou variables GitHub en CI/CD)
var b2cClientId = builder.AddParameter("azure-b2c-client-id");
var b2cAuthority = builder.AddParameter("azure-b2c-authority");
var b2cKnownAuthorities = builder.AddParameter("azure-b2c-known-authorities");
var b2cTenantId = builder.AddParameter("azure-b2c-tenant-id");



// PostgreSQL - Uses Azure Flexible Server with Entra ID (managed identity) by default
// In development, this runs as a container but maintains compatibility with Azure authentication
var postgresDb = builder.AddAzurePostgresFlexibleServer("postgres")
    .RunAsContainer(opt =>
    {
        opt.WithLifetime(ContainerLifetime.Persistent);
        opt.WithPgWeb()
            .WithLifetime(ContainerLifetime.Persistent);
        opt.WithDataVolume(isReadOnly: false);
    })
    .AddDatabase("satisfactory");


// SvelteKit app - Configuration managed by infra/svelte.tmpl.yaml template
builder.AddNpmApp("svelte", "../SatisfactoryManager.SvelteKit", "dev")
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithReference(postgresDb)
    .WithExternalHttpEndpoints()
    .WithEnvironment("AZURE_B2C_CLIENT_ID", b2cClientId)
    .WithEnvironment("AZURE_B2C_AUTHORITY", b2cAuthority)
    .WithEnvironment("AZURE_B2C_KNOWN_AUTHORITIES", b2cKnownAuthorities)
    .WithEnvironment("AZURE_B2C_TENANT_ID", b2cTenantId)
    .WithEnvironment("PUBLIC_AZURE_B2C_CLIENT_ID", b2cClientId)
    .WithEnvironment("PUBLIC_AZURE_B2C_AUTHORITY", b2cAuthority)
    .WithEnvironment("PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES", b2cKnownAuthorities)
    .PublishAsDockerFile();

builder.Build().Run();
