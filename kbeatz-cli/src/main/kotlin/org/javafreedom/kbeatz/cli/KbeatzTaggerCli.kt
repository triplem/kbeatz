package org.javafreedom.kbeatz.cli

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.main
import com.github.ajalt.clikt.core.subcommands
import org.javafreedom.kbeatz.cli.command.MigrateIdFilesCommand
import org.javafreedom.kbeatz.cli.command.TagAlbumsCommand

class KbeatzTaggerCli : CliktCommand(
    name = "kbeatz-tagger",
) {
    override fun help(context: Context) =
        "kbeatz CLI - tag FLAC albums from Discogs metadata and migrate id files."

    override fun run() = Unit
}

fun main(args: Array<String>) {
    KbeatzTaggerCli()
        .subcommands(TagAlbumsCommand(), MigrateIdFilesCommand())
        .main(args)
}
