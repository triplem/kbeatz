package org.javafreedom.kbeatz.catalog.infrastructure.persistence

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.github.oshai.kotlinlogging.KotlinLogging
import javax.sql.DataSource
import liquibase.Liquibase
import liquibase.database.DatabaseFactory
import liquibase.database.jvm.JdbcConnection
import liquibase.resource.ClassLoaderResourceAccessor
import org.jetbrains.exposed.v1.jdbc.Database

private val log = KotlinLogging.logger {}

/**
 * Wires the database stack: HikariCP connection pool → Liquibase migrations → Exposed ORM.
 *
 * Call [init] exactly once on application startup. The returned [HikariDataSource] should
 * be closed on application shutdown.
 */
object DbFactory {

    private const val CHANGELOG_PATH = "db/changelog/db.changelog-master.yaml"

    fun init(jdbcUrl: String, username: String = "sa", password: String = ""): HikariDataSource {
        log.info { "Initialising database pool: jdbcUrl=$jdbcUrl" }
        val dataSource = createDataSource(jdbcUrl, username, password)
        runMigrations(dataSource)
        Database.connect(dataSource)
        log.info { "Database initialised successfully" }
        return dataSource
    }

    @Suppress("MagicNumber") // pool sizing constants: timeout in ms, pool sizes per ops guidance
    private fun createDataSource(jdbcUrl: String, username: String, password: String): HikariDataSource {
        val config = HikariConfig().apply {
            this.jdbcUrl = jdbcUrl
            this.username = username
            this.password = password
            maximumPoolSize = 10
            minimumIdle = 2
            connectionTimeout = 30_000L
            idleTimeout = 600_000L
            maxLifetime = 1_800_000L
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
            validate()
        }
        return HikariDataSource(config)
    }

    private fun runMigrations(dataSource: DataSource) {
        log.info { "Running Liquibase migrations from $CHANGELOG_PATH" }
        dataSource.connection.use { conn ->
            val database = DatabaseFactory.getInstance()
                .findCorrectDatabaseImplementation(JdbcConnection(conn))
            Liquibase(CHANGELOG_PATH, ClassLoaderResourceAccessor(), database).use { liquibase ->
                liquibase.update()
            }
        }
        log.info { "Liquibase migrations completed" }
    }
}
