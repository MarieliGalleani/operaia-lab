# Proof — GitHub Domain Signal E2E

Data: 2026-08-07

## Objetivo

Validar o fluxo completo:

GitHub Webhook → Domain Signal → Decision Policy → Mission → Worker Runtime

## Endpoint validado

POST:

/api/v1/webhooks/github

## Repository

marieligalleani/operaia-core-nexo

## Evento

github.push

## Resultado Webhook

HTTP Status:

202

Outcome:

converted

Decision:

CONVERT_CANDIDATE

## Domain Signal

ID:

5fab27ea-7043-439c-8e38-c4ad8faca214

Workspace:

nexo

Source:

github

Delivery:

teste-domain-signal-003

## Mission

Owner:

operaia-ceo

Kind:

COORDINATE

Status:

COMPLETED

Readiness:

READY

## Resultado

O GitHub Bridge recebeu o evento, validou assinatura HMAC, resolveu o WorkspaceSourceBinding, criou o DomainSignal, converteu em missão 
e o Digital Team executou a missão com sucesso.
